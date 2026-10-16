/**
 * What a participant may see of a test. Answer keys and explanations never leave the server before
 * results are released: the schema hides them (select:false) AND these functions build participant
 * payloads from an allow-list, so a field added later can't leak by accident.
 */
import { quizPhase } from '../models/Quiz.js';

const ORGANIZER_FIELDS = 'name username role designation yearLabel verificationStatus profilePicture institution';
export { ORGANIZER_FIELDS };

/** Test details for the join / instructions pages (no questions). */
export function publicQuizInfo(quiz, now = new Date()) {
  const s = quiz.settings ?? {};
  const negative = quiz.questions?.some((q) => q.negativeMarks > 0);
  return {
    _id: quiz._id,
    title: quiz.title,
    description: quiz.description,
    instructions: quiz.instructions,
    category: quiz.category,
    difficulty: quiz.difficulty,
    organizer: quiz.organizer && typeof quiz.organizer === 'object' && quiz.organizer.name ? pick(quiz.organizer, ['_id', 'name', 'username', 'profilePicture', 'verificationStatus', 'role', 'designation', 'yearLabel', 'institution']) : quiz.organizer,
    startTime: quiz.startTime,
    endTime: quiz.endTime,
    durationMinutes: quiz.durationMinutes,
    questionCount: quiz.questions?.length ?? 0,
    totalMarks: quiz.totalMarks,
    negativeMarking: Boolean(negative),
    phase: quizPhase(quiz, now),
    settings: {
      maxAttempts: s.maxAttempts,
      passPercent: s.passPercent,
      resultVisibility: s.resultVisibility,
      showLeaderboard: s.showLeaderboard,
      allowedFullscreenExits: s.allowedFullscreenExits,
      allowedTabSwitches: s.allowedTabSwitches,
      desktopOnly: s.desktopOnly,
      listed: Boolean(s.listed),
      perQuestionTimer: quiz.questions?.some((q) => q.timeLimitSec > 0) ?? false,
    },
  };
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

/** One question as a participant sees it while taking the test (options in this attempt's order). */
export function participantQuestion(q, optionOrder) {
  const byId = new Map((q.options ?? []).map((o) => [String(o._id), o]));
  const order = optionOrder?.length ? optionOrder : (q.options ?? []).map((o) => String(o._id));
  return {
    _id: String(q._id),
    type: q.type,
    text: q.text,
    image: q.image || '',
    options: order.map((id) => byId.get(String(id))).filter(Boolean).map((o) => ({ _id: String(o._id), text: o.text })),
    marks: q.marks,
    negativeMarks: q.negativeMarks || 0,
    timeLimitSec: q.timeLimitSec || 0,
  };
}

/** The questions of an attempt, in its order. */
export function attemptQuestions(quiz, attempt) {
  const byId = new Map(quiz.questions.map((q) => [String(q._id), q]));
  const optionOrder = attempt.optionOrder instanceof Map ? attempt.optionOrder : new Map(Object.entries(attempt.optionOrder ?? {}));
  return attempt.questionOrder.map((id) => byId.get(id)).filter(Boolean).map((q) => participantQuestion(q, optionOrder.get(String(q._id))));
}

/** The participant's view of their attempt (never the session token, never other people's data). */
export function attemptState(attempt, now = new Date()) {
  return {
    _id: attempt._id,
    quiz: attempt.quiz?._id ?? attempt.quiz,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    serverNow: now,
    answers: (attempt.answers ?? []).map((a) => ({
      questionId: a.questionId,
      selected: a.selected,
      markedForReview: a.markedForReview,
      timeSpentSec: a.timeSpentSec,
      firstSeenAt: a.firstSeenAt,
    })),
    fullscreenExits: attempt.fullscreenExits,
    tabSwitches: attempt.tabSwitches,
    disqualifiedAt: attempt.disqualifiedAt,
    disqualifiedReason: attempt.disqualifiedReason,
  };
}

/** Strips anything that isn't plain text: control characters (keeps newlines / tabs). */
export const cleanText = (s, max) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
