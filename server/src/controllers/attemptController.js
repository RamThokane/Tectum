import mongoose from 'mongoose';
import { Quiz } from '../models/Quiz.js';
import { Attempt, RANKED, FINISHED } from '../models/Attempt.js';
import { User } from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { normalizeCode, newSessionToken, seededShuffle } from '../utils/quizCode.js';
import { publicQuizInfo, attemptQuestions, attemptState, ORGANIZER_FIELDS } from '../utils/quizSanitize.js';
import {
  loadQuizWithKey,
  eligibility,
  finalizeAttempt,
  expireIfDue,
  recordViolation,
  refreshRanks,
  resultsReleased,
  isMobileUA,
  isPhoneUA,
  FULLSCREEN_REQUIRED,
  GRACE_MS,
  SESSION_STALE_MS,
} from '../utils/quizAttempts.js';

/**
 * Tests, participant side. Never trusts the browser: time comes from expiresAt, scores are
 * computed here, every attempt request must carry the attempt's session token (one tab only),
 * and answer keys are never sent before results are released.
 */
const SESSION_HEADER = 'x-attempt-session';
const userAgentOf = (req) => String(req.headers['user-agent'] ?? '').slice(0, 300);

// ---------------------------------------------------------------- joining and starting

/** POST /quizzes/join { code } - checks the code and says whether (and when) I can take the test. */
export const joinQuiz = asyncHandler(async (req, res) => {
  const code = normalizeCode(req.body.code);
  const quiz = code.length >= 6 ? await Quiz.findOne({ accessCode: code, status: 'published', deletedAt: null }).populate('organizer', ORGANIZER_FIELDS) : null;
  if (!quiz) throw ApiError.notFound("That code doesn't match any test. Check it and try again.");
  const now = new Date();
  const elig = await eligibility(quiz, req.user, now);
  // remember that this member has the code (the instructions page and Start need it)
  if (elig.state !== 'blocked') await Quiz.updateOne({ _id: quiz._id }, { $addToSet: { joinedUsers: req.user._id } });
  res.json({ quiz: publicQuizInfo(quiz, now), eligibility: elig, serverNow: now });
});

/** Loads a published test I have joined (entered the code for), or 404. */
async function joinedQuiz(req, { withKey = false } = {}) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Test not found');
  const quiz = withKey ? await loadQuizWithKey(req.params.id) : await Quiz.findById(req.params.id);
  if (!quiz || quiz.status !== 'published') throw ApiError.notFound('Test not found');
  if (!quiz.joinedUsers.some((id) => String(id) === String(req.user._id))) {
    throw ApiError.forbidden(quiz.settings?.listed ? 'Register for this test first; you can open it once the organizer accepts you.' : 'Enter the access code for this test first.');
  }
  return quiz;
}

/** GET /quizzes/:id/info - the instructions page: details, rules and whether I can start. */
export const quizInfo = asyncHandler(async (req, res) => {
  const quiz = await joinedQuiz(req);
  await quiz.populate('organizer', ORGANIZER_FIELDS);
  const now = new Date();
  res.json({ quiz: publicQuizInfo(quiz, now), eligibility: await eligibility(quiz, req.user, now), serverNow: now });
});

/**
 * POST /quizzes/:id/start - creates my attempt (the browser calls this only once it's in full
 * screen) and returns the questions WITHOUT answers, in this attempt's own order.
 */
export const startAttempt = asyncHandler(async (req, res) => {
  const quiz = await joinedQuiz(req, { withKey: true });
  const now = new Date();
  const elig = await eligibility(quiz, req.user, now);
  if (elig.state === 'in_progress') throw ApiError.conflict('You already have this test open. Continue it from that tab.');
  if (elig.state === 'not_started') throw ApiError.badRequest('This test has not started yet.');
  if (elig.state !== 'ready') throw ApiError.forbidden(elig.reason);
  const ua = userAgentOf(req);
  if (quiz.settings?.desktopOnly && isMobileUA(ua)) throw ApiError.forbidden('This test can only be taken on a desktop or laptop computer.');
  // iPhone mode is for phones without full screen; a computer must use full screen
  // (while FULLSCREEN_REQUIRED is off, every device runs without it)
  const mode = req.body?.mode === 'phone' ? 'phone' : 'fullscreen';
  if (mode === 'phone' && FULLSCREEN_REQUIRED && !isPhoneUA(ua)) throw ApiError.badRequest('Full screen is required on this device. Please start the test again.');

  const previous = await Attempt.countDocuments({ quiz: quiz._id, user: req.user._id });
  const _id = new mongoose.Types.ObjectId();
  const ids = quiz.questions.map((q) => String(q._id));
  const questionOrder = quiz.settings?.shuffleQuestions ? seededShuffle(ids, `${_id}:q`) : ids;
  const optionOrder = {};
  for (const q of quiz.questions) {
    const opts = q.options.map((o) => String(o._id));
    // true/false keeps True before False
    optionOrder[String(q._id)] = quiz.settings?.shuffleOptions && q.type !== 'truefalse' ? seededShuffle(opts, `${_id}:${q._id}`) : opts;
  }
  const sessionToken = newSessionToken();
  const expiresAt = new Date(Math.min(now.getTime() + quiz.durationMinutes * 60000, quiz.endTime.getTime()));
  let attempt;
  try {
    attempt = await Attempt.create({
      _id,
      quiz: quiz._id,
      user: req.user._id,
      attemptNumber: previous + 1,
      startedAt: now,
      expiresAt,
      sessionToken,
      lastSeenAt: now,
      questionOrder,
      optionOrder,
      maxScore: quiz.totalMarks,
      ip: String(req.ip ?? '').slice(0, 64),
      userAgent: ua,
      mode,
    });
  } catch (err) {
    // a double click: the unique (quiz, user, attemptNumber) index lets only one through
    if (err?.code === 11000) throw ApiError.conflict('Your test is already starting. Please wait a moment.');
    throw err;
  }
  await Quiz.updateOne({ _id: quiz._id }, { $inc: { attemptCount: 1 } });
  res.status(201).json({ attempt: attemptState(attempt, now), questions: attemptQuestions(quiz, attempt), sessionToken, quiz: publicQuizInfo(quiz, now) });
});

/** GET /quizzes/:id/leaderboard - if the organizer shows it (and results are out). */
export const leaderboard = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Test not found');
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz || quiz.status !== 'published') throw ApiError.notFound('Test not found');
  const isOrganizer = quiz.organizer.equals(req.user._id);
  const took = await Attempt.exists({ quiz: quiz._id, user: req.user._id, status: { $in: FINISHED } });
  if (!isOrganizer && (!took || !quiz.settings?.showLeaderboard || !resultsReleased(quiz))) throw ApiError.forbidden('The leaderboard is not available.');
  res.json({ leaderboard: await leaderboardRows(quiz._id, 100) });
});

async function leaderboardRows(quizId, limit) {
  const ranked = await refreshRanks(quizId);
  const top = ranked.slice(0, limit);
  const users = await User.find({ _id: { $in: top.map((a) => a.user) } }).select('name username profilePicture verificationStatus').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return top.map((a) => ({ rank: a.rank, user: byId.get(String(a.user)) ?? null, score: a.score, percentage: a.percentage, timeTakenSec: a.timeTakenSec }));
}

// ---------------------------------------------------------------- the attempt itself

/** My attempt (with its session token); 404 for anyone else's. */
async function myAttempt(req) {
  if (!mongoose.isValidObjectId(req.params.attemptId)) throw ApiError.notFound('Attempt not found');
  const a = await Attempt.findById(req.params.attemptId).select('+sessionToken');
  if (!a || !a.user.equals(req.user._id)) throw ApiError.notFound('Attempt not found');
  return a;
}

/**
 * Checks the session token. A different tab or device is refused (and logged); a page that was
 * closed or crashed and is now reopened counts as leaving full screen (SESSION_LOST), and if the
 * test's rules still allow it, the new page gets a fresh token.
 * Returns { attempt, sessionToken? } - sessionToken only when a new one was issued.
 */
async function checkSession(req, attempt, quiz, { allowNewSession = false } = {}) {
  const token = String(req.headers[SESSION_HEADER] ?? '');
  if (attempt.status !== 'in_progress' || (token && token === attempt.sessionToken)) return { attempt };
  const now = Date.now();
  const alive = attempt.lastSeenAt && now - attempt.lastSeenAt.getTime() < SESSION_STALE_MS;
  if (alive || !allowNewSession) {
    await recordViolation(attempt._id, quiz, { type: 'MULTIPLE_SESSION', meta: alive ? 'opened in another tab or device (blocked)' : 'request without this tab\'s session', userAgent: userAgentOf(req) });
    throw ApiError.conflict('This test is open in another tab or device. Only one can be used at a time.');
  }
  const { attempt: after } = await recordViolation(attempt._id, quiz, { type: 'SESSION_LOST', meta: 'test page reopened after closing / crashing', userAgent: userAgentOf(req) });
  if (after.status !== 'in_progress') return { attempt: after };
  const sessionToken = newSessionToken();
  const updated = await Attempt.findOneAndUpdate({ _id: attempt._id, status: 'in_progress' }, { sessionToken, lastSeenAt: new Date() }, { returnDocument: 'after' });
  return { attempt: updated ?? after, sessionToken };
}

/** GET /attempts/:attemptId - reopen my attempt (questions + my saved answers). */
export const getAttempt = asyncHandler(async (req, res) => {
  let attempt = await myAttempt(req);
  const quiz = await loadQuizWithKey(attempt.quiz);
  attempt = await expireIfDue(attempt);
  const s = await checkSession(req, await Attempt.findById(attempt._id).select('+sessionToken'), quiz, { allowNewSession: true });
  const now = new Date();
  const live = s.attempt.status === 'in_progress';
  res.json({
    attempt: attemptState(s.attempt, now),
    questions: live ? attemptQuestions(quiz, s.attempt) : [],
    quiz: publicQuizInfo(quiz, now),
    ...(s.sessionToken ? { sessionToken: s.sessionToken } : {}),
  });
});

/** POST /attempts/:attemptId/heartbeat - "still here": keeps the session alive, syncs the clock. */
export const heartbeat = asyncHandler(async (req, res) => {
  let attempt = await myAttempt(req);
  attempt = await expireIfDue(attempt);
  if (attempt.status === 'in_progress') {
    const quiz = await Quiz.findById(attempt.quiz).select('settings');
    await checkSession(req, attempt, quiz);
    await Attempt.updateOne({ _id: attempt._id, status: 'in_progress' }, { lastSeenAt: new Date() });
  }
  res.json({ status: attempt.status, expiresAt: attempt.expiresAt, serverNow: new Date(), disqualifiedReason: attempt.disqualifiedReason });
});

/**
 * PATCH /attempts/:attemptId/answer { answers: [{ questionId, selected, markedForReview, timeSpentSec, seen }] }
 * Autosave (batched: answers queued while offline arrive together). Refused after the deadline
 * (+ a few seconds' grace) and, for a timed question, after its own time limit.
 */
export const saveAnswers = asyncHandler(async (req, res) => {
  let attempt = await myAttempt(req);
  attempt = await expireIfDue(attempt);
  if (attempt.status !== 'in_progress') return res.status(409).json({ message: 'This attempt has ended.', status: attempt.status });
  const quiz = await Quiz.findById(attempt.quiz);
  await checkSession(req, attempt, quiz);
  const now = new Date();
  if (now.getTime() > attempt.expiresAt.getTime() + GRACE_MS) throw ApiError.conflict('Time is up.');

  const byQ = new Map(quiz.questions.map((q) => [String(q._id), q]));
  const inAttempt = new Set(attempt.questionOrder);
  const rejected = [];
  // Retry on a concurrent save (optimistic: the version must not have changed under us).
  for (let tries = 0; tries < 3; tries++) {
    const cur = tries ? await Attempt.findById(attempt._id) : attempt;
    if (cur.status !== 'in_progress') return res.status(409).json({ message: 'This attempt has ended.', status: cur.status });
    const answers = new Map(cur.answers.map((a) => [a.questionId, a.toObject ? a.toObject() : a]));
    rejected.length = 0;
    for (const item of req.body.answers) {
      const q = byQ.get(item.questionId);
      if (!q || !inAttempt.has(item.questionId)) {
        rejected.push({ questionId: item.questionId, reason: 'not in this test' });
        continue;
      }
      const prev = answers.get(item.questionId) ?? { questionId: item.questionId, selected: [], timeSpentSec: 0, markedForReview: false };
      const next = { ...prev };
      if (!next.firstSeenAt && (item.seen || item.selected)) next.firstSeenAt = now;
      if (item.selected !== undefined) {
        // a timed question locks once its own time is up
        if (q.timeLimitSec > 0 && next.firstSeenAt && now - new Date(next.firstSeenAt) > q.timeLimitSec * 1000 + GRACE_MS) {
          rejected.push({ questionId: item.questionId, reason: "this question's time is up" });
        } else {
          const valid = new Set(q.options.map((o) => String(o._id)));
          let sel = item.selected.map(String);
          if (q.type === 'short') sel = sel.slice(0, 1).map((s) => s.trim().slice(0, 200)).filter(Boolean);
          else {
            sel = [...new Set(sel.filter((s) => valid.has(s)))];
            if (q.type !== 'multiple') sel = sel.slice(0, 1);
          }
          next.selected = sel;
          next.answeredAt = now;
        }
      }
      if (item.markedForReview !== undefined) next.markedForReview = item.markedForReview;
      if (item.timeSpentSec !== undefined) next.timeSpentSec = Math.min(Math.round(item.timeSpentSec), Math.round((now - attempt.startedAt) / 1000) + 5);
      answers.set(item.questionId, next);
    }
    const ok = await Attempt.findOneAndUpdate(
      { _id: cur._id, status: 'in_progress', __v: cur.__v },
      { $set: { answers: [...answers.values()], lastSeenAt: now }, $inc: { __v: 1 } },
      { returnDocument: 'after' }
    );
    if (ok) return res.json({ saved: req.body.answers.length - rejected.length, rejected, serverNow: now, expiresAt: ok.expiresAt });
  }
  throw ApiError.conflict('Could not save right now - trying again.');
});

/** POST /attempts/:attemptId/violation { type, meta } - the server decides what it means. */
export const reportViolation = asyncHandler(async (req, res) => {
  const attempt = await myAttempt(req);
  if (attempt.status !== 'in_progress') return res.json({ status: attempt.status, disqualifiedReason: attempt.disqualifiedReason });
  const quiz = await Quiz.findById(attempt.quiz).select('settings');
  // A violation from another tab still counts for the attempt, but is logged as such.
  const token = String(req.headers[SESSION_HEADER] ?? '');
  const meta = token === attempt.sessionToken ? req.body.meta : `${req.body.meta} (from another tab)`.trim();
  const { attempt: after, warning } = await recordViolation(attempt._id, quiz, { type: req.body.type, meta, userAgent: userAgentOf(req) });
  res.json({ status: after.status, warning, disqualifiedAt: after.disqualifiedAt, disqualifiedReason: after.disqualifiedReason });
});

/** POST /attempts/:attemptId/submit - I'm done (or the timer ran out in the page). */
export const submitAttempt = asyncHandler(async (req, res) => {
  let attempt = await myAttempt(req);
  attempt = await expireIfDue(attempt);
  if (attempt.status === 'in_progress') {
    const quiz = await loadQuizWithKey(attempt.quiz);
    await checkSession(req, attempt, quiz);
    const late = Date.now() > attempt.expiresAt.getTime();
    attempt = await finalizeAttempt(attempt._id, late || req.body?.auto ? 'auto_submitted' : 'submitted', { quiz });
  }
  res.json({ status: attempt.status, submittedAt: attempt.submittedAt });
});

// ---------------------------------------------------------------- results

/**
 * GET /attempts/:attemptId/result - my score and statistics, once the organizer releases results
 * (straight after submitting, or after the window closes). Correct answers and explanations only
 * if the organizer allows it.
 */
export const attemptResult = asyncHandler(async (req, res) => {
  let attempt = await myAttempt(req);
  attempt = await expireIfDue(attempt);
  const quiz = await loadQuizWithKey(attempt.quiz);
  await quiz.populate('organizer', ORGANIZER_FIELDS);
  const now = new Date();
  const info = publicQuizInfo(quiz, now);
  if (attempt.status === 'in_progress') return res.json({ quiz: info, attempt: attemptState(attempt, now), released: false, inProgress: true });
  if (!resultsReleased(quiz, now)) {
    return res.json({ quiz: info, attempt: { _id: attempt._id, status: attempt.status, submittedAt: attempt.submittedAt, disqualifiedReason: attempt.disqualifiedReason }, released: false, availableAt: quiz.endTime });
  }

  const ranked = await refreshRanks(quiz._id);
  const fresh = await Attempt.findById(attempt._id).lean();
  const n = ranked.length;
  const mine = ranked.find((a) => String(a._id) === String(fresh._id));
  // percentile: the share of ranked participants scoring the same as or less than me (top = 100)
  const atOrBelow = mine ? ranked.filter((a) => a.score <= mine.score).length : 0;
  const scores = ranked.map((a) => a.score);
  const showAnswers = quiz.settings?.showAnswers !== false;
  const byQ = new Map(quiz.questions.map((q) => [String(q._id), q]));
  const answers = new Map((fresh.answers ?? []).map((a) => [a.questionId, a]));
  const results = new Map((fresh.results ?? []).map((r) => [r.questionId, r]));
  const optionOrder = fresh.optionOrder ?? {};

  res.json({
    quiz: info,
    released: true,
    attempt: {
      _id: fresh._id,
      status: fresh.status,
      attemptNumber: fresh.attemptNumber,
      score: fresh.score,
      maxScore: fresh.maxScore || quiz.totalMarks,
      percentage: fresh.percentage,
      passed: fresh.passed,
      rank: RANKED.includes(fresh.status) ? fresh.rank ?? mine?.rank ?? null : null,
      rankedOutOf: n,
      percentile: mine && n ? Math.round((atOrBelow / n) * 1000) / 10 : null,
      correctCount: fresh.correctCount,
      wrongCount: fresh.wrongCount,
      unattemptedCount: fresh.unattemptedCount,
      negativeLost: fresh.negativeLost,
      timeTakenSec: fresh.timeTakenSec,
      startedAt: fresh.startedAt,
      submittedAt: fresh.submittedAt,
      disqualifiedAt: fresh.disqualifiedAt,
      disqualifiedReason: fresh.disqualifiedReason,
      reinstatedAt: fresh.reinstatedAt,
    },
    comparison: { average: n ? Math.round((scores.reduce((x, y) => x + y, 0) / n) * 100) / 100 : 0, highest: n ? Math.max(...scores) : 0, participants: n },
    review: (fresh.questionOrder ?? []).map((id, i) => {
      const q = byQ.get(id);
      if (!q) return null;
      const order = optionOrder[id] ?? q.options.map((o) => String(o._id));
      const opts = new Map(q.options.map((o) => [String(o._id), o]));
      return {
        number: i + 1,
        _id: id,
        type: q.type,
        text: q.text,
        image: q.image,
        options: order.map((oid) => opts.get(oid)).filter(Boolean).map((o) => ({ _id: String(o._id), text: o.text })),
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        selected: answers.get(id)?.selected ?? [],
        timeSpentSec: answers.get(id)?.timeSpentSec ?? 0,
        outcome: results.get(id)?.outcome ?? 'unattempted',
        marksAwarded: results.get(id)?.marks ?? 0,
        ...(showAnswers ? { correctAnswers: q.correctAnswers, explanation: q.explanation } : {}),
      };
    }).filter(Boolean),
    leaderboard: quiz.settings?.showLeaderboard ? await leaderboardRows(quiz._id, 10) : null,
  });
});

/** GET /attempts/mine - every test I've taken, newest first. */
export const myAttempts = asyncHandler(async (req, res) => {
  const attempts = await Attempt.find({ user: req.user._id, status: { $ne: 'voided' } })
    .select('quiz attemptNumber status score maxScore percentage passed rank startedAt submittedAt expiresAt timeTakenSec disqualifiedReason')
    .populate({ path: 'quiz', select: 'title category endTime organizer settings.resultVisibility totalMarks deletedAt', populate: { path: 'organizer', select: 'name' } })
    .sort({ startedAt: -1 })
    .limit(200)
    .lean();
  const now = new Date();
  res.json({
    attempts: attempts.map((a) => {
      const released = a.quiz && resultsReleased(a.quiz, now);
      return {
        _id: a._id,
        quiz: a.quiz ? { _id: a.quiz._id, title: a.quiz.title, category: a.quiz.category, organizer: a.quiz.organizer, endTime: a.quiz.endTime, totalMarks: a.quiz.totalMarks } : null,
        attemptNumber: a.attemptNumber,
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        expiresAt: a.expiresAt,
        released: Boolean(released),
        ...(released ? { score: a.score, maxScore: a.maxScore, percentage: a.percentage, passed: a.passed, rank: a.rank ?? null, timeTakenSec: a.timeTakenSec } : {}),
        disqualifiedReason: a.disqualifiedReason,
      };
    }),
  });
});
