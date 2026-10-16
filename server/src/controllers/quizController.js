import mongoose from 'mongoose';
import { Quiz, quizPhase, totalMarksOf } from '../models/Quiz.js';
import { Attempt, RANKED, FINISHED } from '../models/Attempt.js';
import { User } from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { assignAccessCode } from '../utils/quizCode.js';
import { importQuestions } from '../utils/quizImport.js';
import { cleanText } from '../utils/quizSanitize.js';
import { loadQuizWithKey, refreshRanks } from '../utils/quizAttempts.js';
import { quizStats, rankAttempts } from '../utils/quizScoring.js';
import { notifyQuiz } from '../utils/notify.js';
import { escapeRegex } from '../utils/serializers.js';
import { ACTIVE_USER } from '../utils/visibility.js';
import { hiddenAuthorsFor } from '../utils/blocking.js';
import { assertFile, MAX_IMAGE_BYTES } from '../middleware/upload.js';
import { saveFile } from '../utils/storage.js';
import { FREE_HOSTED_TESTS } from '../models/QuizHost.js';
import { assertCanHost, publishedCount } from './quizHostController.js';

/**
 * Tests ("quizzes"), organizer side: create, edit, publish, share the code, invite members,
 * import questions, see results and reinstate a disqualified participant.
 * Participants' side: controllers/attemptController.js.
 */

const ATTEMPT_USER_FIELDS = 'name username profilePicture verificationStatus role institution';
const istFormat = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const ist = (d) => (d ? `${istFormat.format(d)} IST` : '');

/** The organizer's own test (with its answer key). 404 for anyone else, so ids can't be probed. */
async function ownQuiz(req, { withKey = true } = {}) {
  const q = withKey ? await loadQuizWithKey(req.params.id) : await Quiz.findById(req.params.id);
  if (!q || q.deletedAt || !q.organizer.equals(req.user._id)) throw ApiError.notFound('Test not found');
  return q;
}

/** Organizer's view of a test: everything, plus its phase and counts. */
function organizerView(quiz, extra = {}) {
  const o = quiz.toObject ? quiz.toObject() : quiz;
  return { ...o, phase: quizPhase(o), ...extra };
}

/** Problems that stop a test from being published (each with a question number where relevant). */
export function checkQuizForPublish(quiz, now = new Date()) {
  const problems = [];
  if (!quiz.title?.trim()) problems.push('Add a title.');
  if (!quiz.startTime || !quiz.endTime) problems.push('Set the start and end date and time.');
  else {
    if (quiz.endTime <= quiz.startTime) problems.push('The end time must be after the start time.');
    if (quiz.endTime <= now) problems.push('The end time is in the past.');
  }
  if (!(quiz.durationMinutes >= 1)) problems.push('Set the duration (at least 1 minute).');
  if (!quiz.questions?.length) problems.push('Add at least one question.');
  quiz.questions?.forEach((q, i) => {
    const n = `Question ${i + 1}`;
    if (!q.text?.trim()) problems.push(`${n}: write the question.`);
    if (!(q.marks > 0)) problems.push(`${n}: marks must be more than 0.`);
    if (q.type === 'short') {
      if (!q.correctAnswers?.some((c) => String(c).trim())) problems.push(`${n}: add at least one accepted answer.`);
      return;
    }
    const opts = q.options ?? [];
    if (opts.length < 2) problems.push(`${n}: add at least 2 options.`);
    if (opts.some((o) => !o.text?.trim())) problems.push(`${n}: an option is empty.`);
    const ids = new Set(opts.map((o) => String(o._id)));
    const correct = (q.correctAnswers ?? []).filter((c) => ids.has(String(c)));
    if (!correct.length) problems.push(`${n}: mark the correct answer.`);
    if ((q.type === 'single' || q.type === 'truefalse') && correct.length > 1) problems.push(`${n}: only one option can be correct.`);
  });
  return problems;
}

/** Normalises questions from the editor: ids kept, answer keys limited to real options, text cleaned. */
function cleanQuestions(questions) {
  return questions.map((q) => {
    const options = q.type === 'short' ? [] : q.options.map((o) => ({ _id: o._id, text: cleanText(o.text, 500) }));
    const ids = new Set(options.map((o) => o._id));
    const correctAnswers = q.type === 'short' ? q.correctAnswers.map((c) => cleanText(c, 200)).filter(Boolean) : [...new Set(q.correctAnswers.filter((c) => ids.has(c)))];
    return {
      _id: q._id,
      type: q.type,
      text: cleanText(q.text, 4000),
      image: q.image,
      options,
      correctAnswers,
      numericTolerance: q.type === 'short' ? q.numericTolerance : 0,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      explanation: cleanText(q.explanation, 4000),
      timeLimitSec: q.timeLimitSec,
    };
  });
}

/** A fingerprint of the parts of the questions that change scoring (to block edits after the start). */
const questionsSignature = (qs) =>
  JSON.stringify(
    qs.map((q) => [String(q._id), q.type, q.text, (q.options ?? []).map((o) => [String(o._id), o.text]), [...(q.correctAnswers ?? [])].map(String).sort(), q.marks, q.negativeMarks || 0, q.numericTolerance || 0, q.timeLimitSec || 0])
  );

const applyBody = (quiz, body) => {
  for (const k of ['title', 'description', 'instructions', 'category', 'difficulty', 'durationMinutes']) {
    if (body[k] !== undefined) quiz[k] = typeof body[k] === 'string' ? cleanText(body[k], 6000) : body[k];
  }
  if (body.startTime !== undefined) quiz.startTime = body.startTime;
  if (body.endTime !== undefined) quiz.endTime = body.endTime;
  if (body.settings) quiz.settings = { ...(quiz.settings?.toObject?.() ?? quiz.settings ?? {}), ...body.settings };
  if (body.questions) {
    quiz.questions = cleanQuestions(body.questions);
    quiz.totalMarks = totalMarksOf(quiz.questions);
  }
};

// ---------------------------------------------------------------- create / read / update / delete

/** POST /quizzes - a new draft. */
export const createQuiz = asyncHandler(async (req, res) => {
  assertCanHost(req.user);
  const quiz = new Quiz({ organizer: req.user._id });
  applyBody(quiz, req.body);
  await quiz.save();
  res.status(201).json({ quiz: organizerView(await loadQuizWithKey(quiz._id)) });
});

/** GET /quizzes/mine - my tests with participant counts and average score. */
export const myQuizzes = asyncHandler(async (req, res) => {
  const quizzes = await Quiz.find({ organizer: req.user._id, deletedAt: null })
    .select('title category difficulty status startTime endTime durationMinutes accessCode isJoinable totalMarks attemptCount createdAt updatedAt chargeable settings.maxAttempts settings.listed')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const ids = quizzes.map((q) => q._id);
  const rows = await Attempt.aggregate([
    { $match: { quiz: { $in: ids }, status: { $ne: 'voided' } } },
    {
      $group: {
        _id: '$quiz',
        people: { $addToSet: '$user' },
        avg: { $avg: { $cond: [{ $in: ['$status', RANKED] }, '$score', null] } },
      },
    },
  ]);
  const byQuiz = new Map(rows.map((r) => [String(r._id), r]));
  res.json({
    quizzes: quizzes.map((q) => {
      const r = byQuiz.get(String(q._id));
      return { ...q, phase: quizPhase(q), participants: r?.people.length ?? 0, averageScore: r?.avg != null ? Math.round(r.avg * 100) / 100 : null };
    }),
  });
});

/** GET /quizzes/:id - the full test for its organizer (answers included). */
export const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req);
  await quiz.populate('invitedUsers', ATTEMPT_USER_FIELDS);
  res.json({ quiz: organizerView(quiz), serverNow: new Date() });
});

/**
 * PUT /quizzes/:id - edit. Rules:
 *   - drafts, and published tests nobody has started: anything (time changes notify invitees)
 *   - once anyone has started: questions, timing and the anti-cheating rules are locked; the
 *     title, texts and the result settings can still change
 */
export const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req);
  const body = req.body;
  const locked = quiz.attemptCount > 0 || (quiz.status === 'published' && quizPhase(quiz) !== 'scheduled');
  if (locked) {
    const changed = [];
    if (body.questions && questionsSignature(cleanQuestions(body.questions)) !== questionsSignature(quiz.questions)) changed.push('questions');
    const same = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
    if (body.startTime !== undefined && !same(body.startTime, quiz.startTime)) changed.push('start time');
    if (body.endTime !== undefined && !same(body.endTime, quiz.endTime)) changed.push('end time');
    if (body.durationMinutes !== undefined && body.durationMinutes !== quiz.durationMinutes) changed.push('duration');
    const LOCKED_SETTINGS = ['shuffleQuestions', 'shuffleOptions', 'maxAttempts', 'partialMarking', 'allowedFullscreenExits', 'allowedTabSwitches', 'passPercent', 'desktopOnly'];
    for (const k of LOCKED_SETTINGS) if (body.settings?.[k] !== undefined && body.settings[k] !== quiz.settings?.[k]) changed.push(k);
    if (changed.length) {
      throw ApiError.conflict(`People have already started this test, so these can't change any more: ${changed.join(', ')}.`);
    }
  }
  const before = { start: quiz.startTime?.getTime(), end: quiz.endTime?.getTime() };
  applyBody(quiz, body);
  if (quiz.status === 'published') {
    const problems = checkQuizForPublish(quiz);
    if (problems.length) throw ApiError.badRequest(problems[0]);
  }
  await quiz.save();

  // The time of a published test moved: tell everyone who was invited or joined.
  const moved = quiz.status === 'published' && (before.start !== quiz.startTime?.getTime() || before.end !== quiz.endTime?.getTime());
  if (moved) {
    const people = [...new Set([...quiz.invitedUsers, ...quiz.joinedUsers].map(String))];
    const note = `"${quiz.title}" now runs ${ist(quiz.startTime)} to ${ist(quiz.endTime)}.`;
    const link = quiz.settings?.listed ? `/quiz/${quiz._id}/details` : `/quiz/join?code=${quiz.accessCode}`;
    await Promise.all(people.map((p) => notifyQuiz({ recipient: p, sourceUser: req.user._id, type: 'quiz_update', quiz: quiz._id, note, link })));
  }
  res.json({ quiz: organizerView(await loadQuizWithKey(quiz._id)), notified: moved });
});

/** DELETE /quizzes/:id - gone; or, if people took it, hidden from me but kept for their results. */
export const deleteQuiz = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req, { withKey: false });
  const taken = await Attempt.exists({ quiz: quiz._id });
  if (taken) {
    await Quiz.updateOne({ _id: quiz._id }, { deletedAt: new Date(), isJoinable: false });
    return res.json({ message: 'Test removed. Participants can still see their own results.', soft: true });
  }
  await Quiz.deleteOne({ _id: quiz._id });
  res.json({ message: 'Test deleted', soft: false });
});

/** POST /quizzes/:id/duplicate - a draft copy (no code, no invitations, no attempts). */
export const duplicateQuiz = asyncHandler(async (req, res) => {
  assertCanHost(req.user);
  const src = await ownQuiz(req);
  const o = src.toObject();
  const copy = await Quiz.create({
    organizer: req.user._id,
    title: `Copy of ${o.title}`.slice(0, 150),
    description: o.description,
    instructions: o.instructions,
    category: o.category,
    difficulty: o.difficulty,
    durationMinutes: o.durationMinutes,
    questions: o.questions,
    settings: o.settings,
    totalMarks: o.totalMarks,
  });
  res.status(201).json({ quiz: organizerView(await loadQuizWithKey(copy._id)) });
});

// ---------------------------------------------------------------- publishing and the code

/**
 * POST /quizzes/:id/publish - checks everything, then makes the access code. Approved hosts only;
 * after their free tests (FREE_HOSTED_TESTS) a test is marked chargeable (upload charge).
 */
export const publishQuiz = asyncHandler(async (req, res) => {
  assertCanHost(req.user);
  const quiz = await ownQuiz(req);
  if (quiz.status === 'published') throw ApiError.badRequest('This test is already published');
  const problems = checkQuizForPublish(quiz);
  if (problems.length) return res.status(400).json({ message: problems[0], problems });
  quiz.status = 'published';
  quiz.publishedAt = new Date();
  quiz.totalMarks = totalMarksOf(quiz.questions);
  // admins (Tectum's own tests) are never charged
  quiz.chargeable = !req.user.isAdmin && (await publishedCount(req.user._id)) >= FREE_HOSTED_TESTS;
  await quiz.save();
  await assignAccessCode(Quiz, quiz._id);
  res.json({ quiz: organizerView(await loadQuizWithKey(quiz._id)) });
});

/** POST /quizzes/:id/regenerate-code - a new code; the old one stops working at once. */
export const regenerateCode = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req, { withKey: false });
  if (quiz.status !== 'published') throw ApiError.badRequest('Publish the test first');
  const updated = await assignAccessCode(Quiz, quiz._id);
  res.json({ accessCode: updated.accessCode });
});

/** PATCH /quizzes/:id/joinable { joinable } - open or close the test to participants. */
export const setJoinable = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req, { withKey: false });
  quiz.isJoinable = req.body?.joinable === true;
  await quiz.save();
  res.json({ isJoinable: quiz.isJoinable });
});

// ---------------------------------------------------------------- inviting

/** GET /quizzes/people?q= - members to invite (by name, @handle, or exact email). Never shows emails. */
export const searchPeople = asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  if (q.length < 2) return res.json({ users: [] });
  const handle = q.replace(/^@/, '').toLowerCase();
  const hidden = await hiddenAuthorsFor(req.user, { includeMuted: false });
  const users = await User.find({
    ...ACTIVE_USER,
    _id: { $nin: [req.user._id, ...hidden] },
    $or: [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { username: { $regex: `^${escapeRegex(handle)}` } }, ...(q.includes('@') && q.includes('.') ? [{ email: q.toLowerCase() }] : [])],
  })
    .select(ATTEMPT_USER_FIELDS)
    .limit(10)
    .lean();
  res.json({ users });
});

/**
 * POST /quizzes/:id/invite { userIds } - adds them to the invited list and sends each a notification
 * with the test's details and code. (The organizer's browser can also send them an encrypted DM:
 * chats are end-to-end encrypted, so the server can't write into them.)
 */
export const inviteToQuiz = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req, { withKey: false });
  if (quiz.status !== 'published') throw ApiError.badRequest('Publish the test first, then invite people');
  const ids = [...new Set(req.body.userIds)].filter((id) => String(id) !== String(req.user._id));
  const users = await User.find({ _id: { $in: ids }, ...ACTIVE_USER }).select(ATTEMPT_USER_FIELDS).lean();
  await Quiz.updateOne({ _id: quiz._id }, { $addToSet: { invitedUsers: { $each: users.map((u) => u._id) } } });
  const note = `${req.user.name} invited you to "${quiz.title}" · ${ist(quiz.startTime)} to ${ist(quiz.endTime)} · ${quiz.durationMinutes} min · code ${quiz.accessCode}`;
  const link = `/quiz/join?code=${quiz.accessCode}`;
  const sent = await Promise.all(users.map((u) => notifyQuiz({ recipient: u._id, sourceUser: req.user._id, type: 'quiz_invite', quiz: quiz._id, note, link })));
  res.json({ invited: users.filter((_, i) => sent[i]), skipped: ids.length - sent.filter(Boolean).length });
});

// ---------------------------------------------------------------- import and images

/** POST /quizzes/:id/import { format, content } -> parsed questions (the editor adds them). */
export const importQuizQuestions = asyncHandler(async (req, res) => {
  await ownQuiz(req, { withKey: false });
  const { questions, errors } = importQuestions(req.body.format, req.body.content);
  res.json({ questions, errors });
});

/** POST /quizzes/images (multipart "questionImage") -> { url } for a question's picture. */
export const uploadQuestionImageHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image');
  assertFile(req.file, { maxBytes: MAX_IMAGE_BYTES, label: 'Image' });
  const { url } = await saveFile(req.file, { folder: 'quiz' });
  res.status(201).json({ url });
});

// ---------------------------------------------------------------- results

const summaryRow = (a) => ({
  _id: a._id,
  user: a.user,
  attemptNumber: a.attemptNumber,
  status: a.status,
  score: a.score,
  maxScore: a.maxScore,
  percentage: a.percentage,
  passed: a.passed,
  rank: a.rank ?? null,
  timeTakenSec: a.timeTakenSec,
  startedAt: a.startedAt,
  submittedAt: a.submittedAt,
  violations: (a.violations ?? []).length,
  countedViolations: (a.violations ?? []).filter((v) => v.counted).length,
  disqualifiedReason: a.disqualifiedReason,
  reinstatedAt: a.reinstatedAt,
  mode: a.mode ?? 'fullscreen',
});

/** GET /quizzes/:id/results - every attempt + statistics. */
export const quizResults = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req);
  await refreshRanks(quiz._id);
  const attempts = await Attempt.find({ quiz: quiz._id }).populate('user', ATTEMPT_USER_FIELDS).sort({ rank: 1, score: -1, startedAt: 1 }).lean();
  const finished = attempts.filter((a) => FINISHED.includes(a.status));
  const ranked = rankAttempts(finished.filter((a) => RANKED.includes(a.status)));
  res.json({
    quiz: { _id: quiz._id, title: quiz.title, totalMarks: quiz.totalMarks, phase: quizPhase(quiz), settings: quiz.settings, questionCount: quiz.questions.length },
    attempts: attempts.map(summaryRow),
    stats: quizStats(quiz, ranked, finished),
  });
});

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  // a leading = + - @ would run as a formula in Excel: prefix it
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** GET /quizzes/:id/results/export - the results table as a CSV file. */
export const exportResults = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req);
  await refreshRanks(quiz._id);
  const attempts = await Attempt.find({ quiz: quiz._id }).populate('user', 'name username').sort({ rank: 1, score: -1 }).lean();
  const head = ['Rank', 'Name', 'Handle', 'Attempt', 'Status', 'Score', 'Out of', 'Percent', 'Passed', 'Time taken (s)', 'Correct', 'Wrong', 'Unattempted', 'Violations', 'Mode', 'Started (UTC)', 'Submitted (UTC)', 'Disqualification reason'];
  const lines = [head.map(csvCell).join(',')];
  for (const a of attempts) {
    lines.push(
      [
        a.rank ?? '',
        a.user?.name ?? 'Deleted member',
        a.user?.username ? `@${a.user.username}` : '',
        a.attemptNumber,
        a.status,
        a.score,
        a.maxScore || quiz.totalMarks,
        a.percentage,
        a.passed ? 'yes' : 'no',
        a.timeTakenSec,
        a.correctCount,
        a.wrongCount,
        a.unattemptedCount,
        (a.violations ?? []).length,
        a.mode === 'phone' ? 'No full screen' : 'Full screen',
        a.startedAt?.toISOString() ?? '',
        a.submittedAt?.toISOString() ?? '',
        a.disqualifiedReason ?? '',
      ]
        .map(csvCell)
        .join(',')
    );
  }
  const name = quiz.title.replace(/[^\w-]+/g, '-').slice(0, 50) || 'test';
  res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="${name}-results.csv"`).send(`\uFEFF${lines.join('\r\n')}`);
});

/** GET /quizzes/:id/attempts/:attemptId - one participant in full: answers, marks, violation log. */
export const attemptDetail = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req);
  if (!mongoose.isValidObjectId(req.params.attemptId)) throw ApiError.badRequest('Invalid attempt');
  const a = await Attempt.findOne({ _id: req.params.attemptId, quiz: quiz._id }).populate('user', ATTEMPT_USER_FIELDS).populate('reinstatedBy', 'name').lean();
  if (!a) throw ApiError.notFound('Attempt not found');
  const byQ = new Map(quiz.questions.map((q) => [String(q._id), q]));
  const answers = new Map((a.answers ?? []).map((x) => [x.questionId, x]));
  const results = new Map((a.results ?? []).map((x) => [x.questionId, x]));
  res.json({
    attempt: { ...summaryRow(a), violations: a.violations, correctCount: a.correctCount, wrongCount: a.wrongCount, unattemptedCount: a.unattemptedCount, negativeLost: a.negativeLost, expiresAt: a.expiresAt, reinstatedBy: a.reinstatedBy, reinstateNote: a.reinstateNote, ip: a.ip, userAgent: a.userAgent },
    questions: (a.questionOrder?.length ? a.questionOrder : quiz.questions.map((q) => String(q._id)))
      .map((id) => byQ.get(id))
      .filter(Boolean)
      .map((q) => ({
        _id: String(q._id),
        type: q.type,
        text: q.text,
        image: q.image,
        options: q.options.map((o) => ({ _id: String(o._id), text: o.text })),
        correctAnswers: q.correctAnswers,
        explanation: q.explanation,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        selected: answers.get(String(q._id))?.selected ?? [],
        timeSpentSec: answers.get(String(q._id))?.timeSpentSec ?? 0,
        outcome: results.get(String(q._id))?.outcome ?? null,
        marksAwarded: results.get(String(q._id))?.marks ?? null,
      })),
  });
});

/**
 * POST /quizzes/:id/attempts/:attemptId/reinstate { mode, note } - lift a disqualification:
 *   count  - the attempt is scored and ranked normally (answers up to the disqualification)
 *   retake - the attempt is set aside and the member may start again while the test is open
 * Only disqualified attempts can be reinstated; the action is recorded (who, when, note).
 */
export const reinstateAttempt = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req);
  if (!mongoose.isValidObjectId(req.params.attemptId)) throw ApiError.badRequest('Invalid attempt');
  const status = req.body.mode === 'count' ? 'submitted' : 'voided';
  const a = await Attempt.findOneAndUpdate(
    { _id: req.params.attemptId, quiz: quiz._id, status: 'disqualified' },
    { $set: { status, reinstatedBy: req.user._id, reinstatedAt: new Date(), reinstateNote: req.body.note } },
    { returnDocument: 'after' }
  );
  if (!a) throw ApiError.badRequest('Only a disqualified attempt can be reinstated');
  await User.updateOne({ _id: a.user, quizFlags: { $gt: 0 } }, { $inc: { quizFlags: -1 } });
  await refreshRanks(quiz._id);
  res.json({ status: a.status, message: status === 'submitted' ? 'Reinstated: the attempt now counts.' : 'Reinstated: they can take the test again while it is open.' });
});
