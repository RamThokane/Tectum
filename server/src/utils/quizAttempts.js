import { Quiz, quizPhase } from '../models/Quiz.js';
import { Attempt, RANKED } from '../models/Attempt.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { scoreAttempt, rankAttempts } from './quizScoring.js';

/** Grace after the timer ends for answers already on their way (slow networks). */
export const GRACE_MS = 5000;
/** A page that hasn't sent its heartbeat for this long is closed (or crashed), not open in a tab. */
export const SESSION_STALE_MS = 25_000;
/** Counted violations this close together are one action (see recordViolation). */
const SAME_ACTION_MS = 4000;

/** The quiz with its answer key (for scoring and review only - never sent to participants as is). */
export const loadQuizWithKey = (id) => Quiz.findById(id).select('+questions.correctAnswers +questions.numericTolerance +questions.explanation');

const VIOLATION_LABEL = {
  FULLSCREEN_EXIT: 'left full-screen mode',
  SESSION_LOST: 'closed or reloaded the test page',
  TAB_SWITCH: 'switched to another tab or minimised the window',
  WINDOW_BLUR: 'switched to another window or app',
};
/**
 * Full screen switched OFF for now (iPads had trouble with it): every device starts in the
 * no-full-screen mode ('phone'), where leaving the page counts on the tab allowance. All the other
 * checks stay. Set to true (and FULLSCREEN_REQUIRED in client/src/lib/quiz.js) to bring it back.
 */
export const FULLSCREEN_REQUIRED = false;

/** Which violations count toward disqualification, and against which allowance. */
export const COUNTED = { FULLSCREEN_EXIT: 'fullscreen', SESSION_LOST: 'fullscreen', TAB_SWITCH: 'tab', WINDOW_BLUR: 'tab' };
/** Without full screen, closing / reloading the page is leaving it: it counts as a tab switch. */
const countedKind = (type, mode) => (type === 'SESSION_LOST' && mode === 'phone' ? 'tab' : COUNTED[type]);

const timeIST = (d) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);

/**
 * Ends an in-progress attempt: scores it and sets its final status. Atomic - if two requests try
 * at once (submit + timer + violation), only the first one wins and the others get its result.
 */
export async function finalizeAttempt(attemptId, status, { reason, quiz } = {}) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt || attempt.status !== 'in_progress') return attempt;
  const q = quiz ?? (await loadQuizWithKey(attempt.quiz));
  const now = new Date();
  // an auto-submit counts the time up to the deadline, not up to when the sweep noticed
  const end = status === 'auto_submitted' ? new Date(Math.min(now, attempt.expiresAt)) : now;
  const scored = scoreAttempt(q, attempt);
  const set = {
    ...scored,
    status,
    submittedAt: now,
    timeTakenSec: Math.max(0, Math.round((end - attempt.startedAt) / 1000)),
    ...(status === 'disqualified' ? { disqualifiedAt: now, disqualifiedReason: reason?.slice(0, 300) } : {}),
  };
  const done = await Attempt.findOneAndUpdate({ _id: attemptId, status: 'in_progress' }, { $set: set }, { returnDocument: 'after' });
  if (!done) return Attempt.findById(attemptId); // someone else finished it first
  if (status === 'disqualified') {
    await User.updateOne({ _id: done.user }, { $inc: { quizFlags: 1 }, ...(env.autoBanOnDisqualification ? { $set: { quizBanned: true } } : {}) });
  }
  if (status !== 'disqualified') await refreshRanks(done.quiz);
  return done;
}

/** Past its deadline (plus grace)? Then it's auto-submitted now. Returns the current attempt. */
export async function expireIfDue(attempt) {
  if (attempt?.status === 'in_progress' && Date.now() > attempt.expiresAt.getTime() + GRACE_MS) {
    return finalizeAttempt(attempt._id, 'auto_submitted');
  }
  return attempt;
}

/**
 * Logs a violation and applies the test's rule: within the organizer's allowance it's a warning;
 * one more and the attempt is disqualified and submitted with the answers saved so far.
 * Returns { attempt, warning } where warning = { kind, used, allowed } while still allowed.
 */
export async function recordViolation(attemptId, quiz, { type, meta, userAgent }) {
  let kind = COUNTED[type];
  // One action can fire two signals (leaving a phone's page: "hidden" + "page closed"; a reload:
  // the exit + the reopen). Within a few seconds of a counted one, it's logged but not counted again.
  if (kind) {
    const prev = await Attempt.findById(attemptId).select('violations mode').lean();
    kind = countedKind(type, prev?.mode);
    const last = [...(prev?.violations ?? [])].reverse().find((v) => v.counted && countedKind(v.type, prev?.mode) === kind);
    if (last && Date.now() - new Date(last.at).getTime() < SAME_ACTION_MS) {
      kind = null;
      meta = `${meta ?? ''} (same moment as the previous one, not counted again)`.trim();
    }
  }
  const field = kind === 'fullscreen' ? 'fullscreenExits' : kind === 'tab' ? 'tabSwitches' : null;
  const now = new Date();
  const updated = await Attempt.findOneAndUpdate(
    { _id: attemptId, status: 'in_progress' },
    {
      $push: { violations: { type, at: now, userAgent: userAgent?.slice(0, 300), meta: meta?.slice(0, 300), counted: Boolean(kind) } },
      ...(field ? { $inc: { [field]: 1 } } : {}),
    },
    { returnDocument: 'after' }
  );
  if (!updated) return { attempt: await Attempt.findById(attemptId), warning: null };
  if (!field) return { attempt: updated, warning: null };
  const allowed = kind === 'fullscreen' ? quiz.settings?.allowedFullscreenExits ?? 0 : quiz.settings?.allowedTabSwitches ?? 0;
  const used = updated[field];
  if (used > allowed) {
    const reason = `Disqualified: ${VIOLATION_LABEL[type]} at ${timeIST(now)} (IST)`;
    return { attempt: await finalizeAttempt(attemptId, 'disqualified', { reason }), warning: null };
  }
  return { attempt: updated, warning: { kind, used, allowed } };
}

/** Recomputes the leaderboard ranks of a test (best counted attempt per member). */
export async function refreshRanks(quizId) {
  const finished = await Attempt.find({ quiz: quizId, status: { $in: RANKED } })
    .select('user score timeTakenSec percentage passed rank status')
    .lean();
  const ranked = rankAttempts(finished);
  const rankOf = new Map(ranked.map((a) => [String(a._id), a.rank]));
  const ops = finished
    .filter((a) => (rankOf.get(String(a._id)) ?? null) !== (a.rank ?? null))
    .map((a) => ({ updateOne: { filter: { _id: a._id }, update: rankOf.has(String(a._id)) ? { $set: { rank: rankOf.get(String(a._id)) } } : { $unset: { rank: 1 } } } }));
  if (ops.length) await Attempt.bulkWrite(ops);
  return ranked;
}

/** Results visible to participants now? (organizer setting: right away, or after the window closes) */
export const resultsReleased = (quiz, now = new Date()) =>
  quiz.settings?.resultVisibility === 'immediate' || (quiz.endTime && now > quiz.endTime) || quiz.deletedAt;

/** Rough mobile check for "desktop only" tests (User-Agent based; the page checks again). */
export const isMobileUA = (ua = '') => /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua);
/**
 * Phones and tablets that may use iPhone / iPad mode (no full screen for web pages there). iPads
 * send a Mac ("Macintosh") User-Agent, so that's accepted too: real Macs support full screen and
 * never ask for this mode, and the organizer sees the mode on every attempt.
 */
export const isPhoneUA = (ua = '') => /iPhone|iPod|iPad|Mobile|Macintosh/i.test(ua);

/**
 * Can this member start (or continue) this test right now?
 *   { state: 'ready' | 'not_started' | 'in_progress' | 'blocked', reason?, startsAt?, attemptsLeft, attemptId? }
 */
export async function eligibility(quiz, user, now = new Date()) {
  const base = { attemptsLeft: 0 };
  const blocked = (reason, extra = {}) => ({ ...base, state: 'blocked', reason, ...extra });
  if (quiz.deletedAt) return blocked('This test was removed by its organizer.');
  if (quiz.status !== 'published') return blocked("This test hasn't been published yet.");
  if (String(quiz.organizer?._id ?? quiz.organizer) === String(user._id)) return blocked("You organised this test, so you can't take it. Use Manage to see results.");
  const me = await User.findById(user._id).select('+quizBanned').lean();
  if (me?.quizBanned) return blocked("You can't take tests at the moment. Please contact Tectum support.");
  const invited = quiz.invitedUsers.some((id) => String(id) === String(user._id));
  // listed tests: registering and being accepted by the host adds the member to invitedUsers
  if (quiz.settings?.listed && !invited) {
    return blocked('Register for this test on its page; you can take it once the organizer accepts your request.', { needsRegistration: true });
  }
  if (quiz.settings?.inviteOnly && !invited) return blocked('This test is only for members the organizer invited.');

  const mine = await Attempt.find({ quiz: quiz._id, user: user._id }).select('status expiresAt').lean();
  const live = mine.find((a) => a.status === 'in_progress');
  if (live) return { ...base, state: 'in_progress', attemptId: live._id };
  if (mine.some((a) => a.status === 'disqualified')) return blocked('You were disqualified from this test, so you cannot take it again.');
  const used = mine.filter((a) => a.status !== 'voided').length;
  const attemptsLeft = Math.max(0, (quiz.settings?.maxAttempts ?? 1) - used);
  if (!attemptsLeft) return blocked(used > 1 ? `You've used all ${used} attempts for this test.` : "You've already attempted this test.");
  if (!quiz.isJoinable) return blocked('The organizer has closed this test to participants.');

  const phase = quizPhase(quiz, now);
  if (phase === 'scheduled') return { state: 'not_started', startsAt: quiz.startTime, attemptsLeft };
  if (phase === 'ended') return blocked('This test has ended.', { endedAt: quiz.endTime });

  if (quiz.settings?.maxParticipants && !used) {
    const people = await Attempt.distinct('user', { quiz: quiz._id, status: { $ne: 'voided' } });
    if (people.length >= quiz.settings.maxParticipants) return blocked('This test is full: the maximum number of participants has been reached.');
  }
  return { state: 'ready', attemptsLeft };
}

/** Auto-submits attempts whose time ran out (people who closed the page, lost connection...). */
export async function sweepExpiredAttempts() {
  const due = await Attempt.find({ status: 'in_progress', expiresAt: { $lt: new Date(Date.now() - GRACE_MS) } })
    .select('_id')
    .limit(200)
    .lean();
  for (const a of due) await finalizeAttempt(a._id, 'auto_submitted');
  return due.length;
}

export function startQuizSweep() {
  const tick = () => sweepExpiredAttempts().catch((err) => console.error('[quiz] auto-submit sweep failed', err.message));
  setTimeout(tick, 10_000);
  return setInterval(tick, 30_000);
}
