import mongoose from 'mongoose';
import { Quiz, quizPhase } from '../models/Quiz.js';
import { Attempt, FINISHED } from '../models/Attempt.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { QuizHostApplication, QuizRegistration, FREE_HOSTED_TESTS } from '../models/QuizHost.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { cleanText, ORGANIZER_FIELDS } from '../utils/quizSanitize.js';
import { refreshRanks, resultsReleased } from '../utils/quizAttempts.js';
import { notifyQuiz, notifyFromTectum } from '../utils/notify.js';
import { ACTIVE_USER } from '../utils/visibility.js';
import { hiddenAuthorsFor } from '../utils/blocking.js';

/**
 * Tests, the "who conducts them" side:
 *   - hosting: members apply to conduct tests; an admin approves (Moderation > Quiz hosts)
 *   - the Quizzes directory (approved hosts) and each host's Tests tab (upcoming / past)
 *   - registration for listed tests: register (name, college) -> pending -> the host accepts ->
 *     the member can start the test once it is live
 */

const HOST_CARD_FIELDS = 'name username profilePicture verificationStatus role designation yearLabel institution bio isOfficial';
const istFormat = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const ist = (d) => (d ? `${istFormat.format(d)} IST` : '');

/** Can this member create and publish tests? (approved hosts, and site admins) */
export const canHost = (user) => Boolean(user?.isAdmin || user?.quizHost === 'approved');

export function assertCanHost(user) {
  if (canHost(user)) return;
  if (user?.quizHost === 'pending') throw ApiError.forbidden('Your application to conduct tests is waiting for approval. You can create tests once Tectum approves it.');
  throw ApiError.forbidden('Only approved quiz hosts can create tests. Apply from the Tests page.');
}

/** Tests this host has published so far (deleted ones too: they were uploaded). */
export const publishedCount = (userId) => Quiz.countDocuments({ organizer: userId, status: 'published' });

// ---------------------------------------------------------------- hosting applications

/**
 * Files an application to conduct tests (sign-up, or the Tests page later). Returns the application,
 * or null when the member can already host or already has one waiting.
 */
export async function submitHostApplication(user, body) {
  if (canHost(user) || user.quizHost === 'pending') return null;
  const app = await QuizHostApplication.create({
    user: user._id,
    orgName: cleanText(body.orgName, 120),
    about: cleanText(body.about, 1000),
    phone: cleanText(body.phone, 30),
    website: cleanText(body.website, 300),
    acceptedTermsAt: new Date(),
  });
  await User.updateOne({ _id: user._id }, { quizHost: 'pending' });
  user.quizHost = 'pending';
  return app;
}

/** GET /quizzes/host/status - can I host, my latest application, and my free tests left. */
export const hostStatus = asyncHandler(async (req, res) => {
  const [application, published] = await Promise.all([
    QuizHostApplication.findOne({ user: req.user._id }).sort({ createdAt: -1 }).select('orgName status note createdAt decidedAt').lean(),
    publishedCount(req.user._id),
  ]);
  res.json({
    status: req.user.isAdmin ? 'approved' : req.user.quizHost,
    canHost: canHost(req.user),
    application,
    freeTests: FREE_HOSTED_TESTS,
    published,
    freeLeft: Math.max(0, FREE_HOSTED_TESTS - published),
  });
});

/** POST /quizzes/host/apply { orgName, about, phone, website, acceptTerms } */
export const applyToHost = asyncHandler(async (req, res) => {
  if (canHost(req.user)) throw ApiError.badRequest('You can already conduct tests.');
  if (req.user.quizHost === 'pending') throw ApiError.conflict('Your application is already waiting for approval.');
  await submitHostApplication(req.user, req.body);
  res.status(201).json({ status: 'pending', message: 'Application sent. We will notify you once Tectum has reviewed it.' });
});

/** GET /admin/quiz-hosts?status=pending|approved|rejected - applications for admins to review. */
export const listHostApplications = asyncHandler(async (req, res) => {
  const status = ['approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const apps = await QuizHostApplication.find({ status })
    .sort({ createdAt: status === 'pending' ? 1 : -1 })
    .limit(200)
    .populate('user', 'name username email role course country institution profilePicture verificationStatus createdAt quizHost')
    .populate('decidedBy', 'name')
    .lean();
  const ids = apps.map((a) => a.user?._id).filter(Boolean);
  const counts = await Quiz.aggregate([{ $match: { organizer: { $in: ids }, status: 'published' } }, { $group: { _id: '$organizer', n: { $sum: 1 } } }]);
  const byUser = new Map(counts.map((c) => [String(c._id), c.n]));
  const pending = status === 'pending' ? apps.length : await QuizHostApplication.countDocuments({ status: 'pending' });
  res.json({
    applications: apps.map((a) => ({ ...a, published: a.user ? byUser.get(String(a.user._id)) ?? 0 : 0 })),
    pending,
    freeTests: FREE_HOSTED_TESTS,
  });
});

/**
 * POST /admin/quiz-hosts/:id { status: approved|rejected, note } - decide an application.
 * Approving an already-approved one again is harmless; rejecting an approved one removes hosting
 * (tests already published stay up).
 */
export const decideHostApplication = asyncHandler(async (req, res) => {
  const app = await QuizHostApplication.findById(req.params.id);
  if (!app) throw ApiError.notFound('Application not found');
  const approved = req.body.status === 'approved';
  app.status = req.body.status;
  app.decidedBy = req.user._id;
  app.decidedAt = new Date();
  app.note = cleanText(req.body.note, 300);
  await app.save();
  const user = await User.findByIdAndUpdate(app.user, { quizHost: approved ? 'approved' : 'rejected' }, { returnDocument: 'after' }).select('name quizHost');
  if (!user) throw ApiError.notFound('That member no longer exists');
  const note = approved
    ? `You can now conduct tests on Tectum as ${app.orgName}. Your first ${FREE_HOSTED_TESTS} tests are free. Create one from Tests.`
    : `Your application to conduct tests was not approved${app.note ? `: ${app.note}` : '.'} You can apply again from Tests.`;
  await notifyFromTectum({ recipient: user._id, type: 'quiz_host', note, link: '/quiz' });
  console.log(`[admin] ${req.user.email} ${approved ? 'approved' : 'rejected'} quiz host ${user._id} (${user.name})`);
  res.json({ status: app.status, quizHost: user.quizHost });
});

// ---------------------------------------------------------------- the Quizzes directory and a host's tests

const listedFilter = (organizer) => ({ organizer, status: 'published', deletedAt: null, 'settings.listed': true });

/** GET /quizzes/hosts - approved hosts (organisations), those with live / upcoming tests first. */
export const listHosts = asyncHandler(async (req, res) => {
  const hidden = await hiddenAuthorsFor(req.user, { includeMuted: false });
  const hosts = await User.find({ ...ACTIVE_USER, quizHost: 'approved', _id: { $nin: hidden } }).select(HOST_CARD_FIELDS).limit(200).lean();
  const now = new Date();
  const counts = await Quiz.aggregate([
    { $match: { organizer: { $in: hosts.map((h) => h._id) }, status: 'published', deletedAt: null, 'settings.listed': true } },
    {
      $group: {
        _id: '$organizer',
        live: { $sum: { $cond: [{ $and: [{ $lte: ['$startTime', now] }, { $gte: ['$endTime', now] }] }, 1, 0] } },
        upcoming: { $sum: { $cond: [{ $gt: ['$startTime', now] }, 1, 0] } },
        past: { $sum: { $cond: [{ $lt: ['$endTime', now] }, 1, 0] } },
        next: { $min: { $cond: [{ $gt: ['$startTime', now] }, '$startTime', null] } },
      },
    },
  ]);
  const byHost = new Map(counts.map((c) => [String(c._id), c]));
  const rows = hosts.map((h) => {
    const c = byHost.get(String(h._id));
    return { ...h, live: c?.live ?? 0, upcoming: c?.upcoming ?? 0, past: c?.past ?? 0, nextStart: c?.next ?? null };
  });
  rows.sort((a, b) => b.live - a.live || b.upcoming - a.upcoming || (a.nextStart ?? Infinity) - (b.nextStart ?? Infinity) || b.past - a.past || a.name.localeCompare(b.name));
  res.json({ hosts: rows });
});

/** A listed test as a card: details, no questions, plus my registration and latest attempt. */
function testCard(q, now, { registration, attempt, accepted }) {
  return {
    _id: q._id,
    title: q.title,
    description: q.description,
    category: q.category,
    difficulty: q.difficulty,
    startTime: q.startTime,
    endTime: q.endTime,
    durationMinutes: q.durationMinutes,
    questionCount: q.questions?.length ?? q.questionCount ?? 0,
    totalMarks: q.totalMarks,
    phase: quizPhase(q, now),
    isJoinable: q.isJoinable,
    accepted: accepted ?? 0,
    maxParticipants: q.settings?.maxParticipants ?? 0,
    showLeaderboard: Boolean(q.settings?.showLeaderboard),
    registration: registration ? { _id: registration._id, status: registration.status, name: registration.name, college: registration.college } : null,
    myAttempt: attempt ? { _id: attempt._id, status: attempt.status } : null,
  };
}

/** My registrations and latest attempts for these tests, keyed by test id. */
async function mineFor(userId, quizIds) {
  const [regs, attempts, accepted] = await Promise.all([
    QuizRegistration.find({ quiz: { $in: quizIds }, user: userId }).lean(),
    Attempt.find({ quiz: { $in: quizIds }, user: userId, status: { $ne: 'voided' } }).select('quiz status startedAt').sort({ startedAt: -1 }).lean(),
    QuizRegistration.aggregate([{ $match: { quiz: { $in: quizIds }, status: 'accepted' } }, { $group: { _id: '$quiz', n: { $sum: 1 } } }]),
  ]);
  const reg = new Map(regs.map((r) => [String(r.quiz), r]));
  const att = new Map();
  for (const a of attempts) if (!att.has(String(a.quiz))) att.set(String(a.quiz), a);
  const acc = new Map(accepted.map((c) => [String(c._id), c.n]));
  return (id) => ({ registration: reg.get(String(id)), attempt: att.get(String(id)), accepted: acc.get(String(id)) ?? 0 });
}

/**
 * GET /quizzes/by/:userId - a host's Tests tab: upcoming (live ones first, then by start time) and
 * past (newest first). Only listed tests; private (code-only) tests never show.
 */
export const hostTests = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) throw ApiError.notFound('Not found');
  const host = await User.findOne({ _id: req.params.userId, ...ACTIVE_USER }).select(`${HOST_CARD_FIELDS} quizHost`).lean();
  if (!host) throw ApiError.notFound('Not found');
  const quizzes = await Quiz.find(listedFilter(host._id))
    .select('title description category difficulty startTime endTime durationMinutes totalMarks isJoinable settings questions._id status')
    .sort({ startTime: 1 })
    .limit(300)
    .lean();
  const now = new Date();
  const mine = await mineFor(req.user._id, quizzes.map((q) => q._id));
  const cards = quizzes.map((q) => testCard(q, now, mine(q._id)));
  const live = cards.filter((c) => c.phase === 'live');
  const scheduled = cards.filter((c) => c.phase === 'scheduled');
  const past = cards.filter((c) => c.phase === 'ended').sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
  res.json({
    host: { _id: host._id, name: host.name, username: host.username, profilePicture: host.profilePicture, verificationStatus: host.verificationStatus, isQuizHost: host.quizHost === 'approved' },
    isSelf: String(host._id) === String(req.user._id),
    upcoming: [...live, ...scheduled],
    past,
    serverNow: now,
  });
});

/** Loads a listed, published test (or any test of mine) for the details page. */
async function visibleQuiz(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Test not found');
  const quiz = await Quiz.findById(req.params.id).populate('organizer', ORGANIZER_FIELDS);
  const mine = quiz && String(quiz.organizer?._id) === String(req.user._id);
  if (!quiz || quiz.deletedAt || quiz.status !== 'published' || (!quiz.settings?.listed && !mine)) throw ApiError.notFound('Test not found');
  return quiz;
}

/**
 * GET /quizzes/:id/details - a listed test's page: details, my registration, and (once it's over,
 * if the host shows it) the leaderboard - visible to every member, like a results board.
 */
export const quizDetails = asyncHandler(async (req, res) => {
  const quiz = await visibleQuiz(req);
  const now = new Date();
  const card = testCard(quiz, now, (await mineFor(req.user._id, [quiz._id]))(quiz._id));
  const phase = quizPhase(quiz, now);
  let leaderboard = null;
  if (phase === 'ended' && quiz.settings?.showLeaderboard && resultsReleased(quiz, now)) {
    const ranked = (await refreshRanks(quiz._id)).slice(0, 100);
    const users = await User.find({ _id: { $in: ranked.map((a) => a.user) } }).select('name username profilePicture verificationStatus').lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    leaderboard = ranked.map((a) => ({ rank: a.rank, user: byId.get(String(a.user)) ?? null, score: a.score, percentage: a.percentage, timeTakenSec: a.timeTakenSec }));
  }
  const finished = phase === 'ended' ? await Attempt.countDocuments({ quiz: quiz._id, status: { $in: FINISHED } }) : null;
  const s = quiz.settings ?? {};
  res.json({
    quiz: {
      ...card,
      instructions: quiz.instructions,
      organizer: quiz.organizer,
      negativeMarking: quiz.questions.some((q) => q.negativeMarks > 0),
      settings: { maxAttempts: s.maxAttempts, passPercent: s.passPercent, resultVisibility: s.resultVisibility, desktopOnly: s.desktopOnly, allowedFullscreenExits: s.allowedFullscreenExits, allowedTabSwitches: s.allowedTabSwitches },
      participants: finished,
    },
    isOrganizer: String(quiz.organizer?._id) === String(req.user._id),
    leaderboard,
    serverNow: now,
  });
});

// ---------------------------------------------------------------- registering for a listed test

/** POST /quizzes/:id/register { name, college } - ask to take the test (the host accepts). */
export const registerForQuiz = asyncHandler(async (req, res) => {
  const quiz = await visibleQuiz(req);
  if (!quiz.settings?.listed) throw ApiError.badRequest('This test is taken with an access code.');
  if (String(quiz.organizer._id) === String(req.user._id)) throw ApiError.badRequest("You organised this test, so you can't register for it.");
  if (quizPhase(quiz) === 'ended') throw ApiError.badRequest('This test has ended.');
  if (!quiz.isJoinable) throw ApiError.badRequest('The organizer has closed registrations for this test.');
  const me = await User.findById(req.user._id).select('+quizBanned').lean();
  if (me?.quizBanned) throw ApiError.forbidden("You can't take tests at the moment. Please contact Tectum support.");

  const existing = await QuizRegistration.findOne({ quiz: quiz._id, user: req.user._id });
  if (existing?.status === 'accepted') return res.json({ registration: existing, message: "You're already registered." });
  if (existing?.status === 'rejected') throw ApiError.forbidden('The organizer declined your request for this test.');
  const name = cleanText(req.body.name, 80);
  const college = cleanText(req.body.college, 150);
  const reg = await QuizRegistration.findOneAndUpdate(
    { quiz: quiz._id, user: req.user._id },
    { $set: { name, college }, $setOnInsert: { status: 'pending' } },
    { upsert: true, returnDocument: 'after' }
  );
  // the host hears about it: one notification per test, with the number waiting
  const waiting = await QuizRegistration.countDocuments({ quiz: quiz._id, status: 'pending' });
  await notifyQuiz({
    recipient: quiz.organizer._id,
    sourceUser: req.user._id,
    type: 'quiz_request',
    quiz: quiz._id,
    note: `${name} (${college}) asked to take "${quiz.title}"${waiting > 1 ? ` · ${waiting} requests waiting` : ''}`,
    link: `/quiz/${quiz._id}/manage?tab=registrations`,
  });
  res.status(existing ? 200 : 201).json({ registration: reg, message: 'Request sent. You can take the test once the organizer accepts it.' });
});

/** DELETE /quizzes/:id/register - withdraw my request (or my place, before I've started). */
export const cancelRegistration = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Test not found');
  const reg = await QuizRegistration.findOne({ quiz: req.params.id, user: req.user._id });
  if (!reg) return res.json({ message: 'Not registered' });
  if (reg.status === 'rejected') throw ApiError.badRequest('The organizer already declined this request.');
  if (await Attempt.exists({ quiz: reg.quiz, user: req.user._id })) throw ApiError.badRequest("You've already taken this test.");
  await QuizRegistration.deleteOne({ _id: reg._id });
  if (reg.status === 'accepted') await Quiz.updateOne({ _id: reg.quiz }, { $pull: { invitedUsers: req.user._id, joinedUsers: req.user._id } });
  res.json({ message: 'Registration withdrawn' });
});

/** GET /quizzes/registrations/mine - my requests for tests that haven't ended (My attempts tab). */
export const myRegistrations = asyncHandler(async (req, res) => {
  const regs = await QuizRegistration.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  const quizzes = await Quiz.find({ _id: { $in: regs.map((r) => r.quiz) }, status: 'published', deletedAt: null, endTime: { $gt: new Date() } })
    .select('title description category difficulty startTime endTime durationMinutes totalMarks isJoinable settings questions._id status organizer')
    .populate('organizer', 'name username profilePicture verificationStatus')
    .lean();
  const now = new Date();
  const mine = await mineFor(req.user._id, quizzes.map((q) => q._id));
  const cards = quizzes
    .map((q) => ({ ...testCard(q, now, mine(q._id)), organizer: q.organizer }))
    .sort((a, b) => (a.phase === 'live' ? 0 : 1) - (b.phase === 'live' ? 0 : 1) || new Date(a.startTime) - new Date(b.startTime));
  res.json({ tests: cards, serverNow: now });
});

// ---------------------------------------------------------------- the host's side of registrations

async function ownListedQuiz(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Test not found');
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz || quiz.deletedAt || !quiz.organizer.equals(req.user._id)) throw ApiError.notFound('Test not found');
  return quiz;
}

/** GET /quizzes/:id/registrations - requests for my test (waiting ones first). */
export const listRegistrations = asyncHandler(async (req, res) => {
  const quiz = await ownListedQuiz(req);
  const regs = await QuizRegistration.find({ quiz: quiz._id }).sort({ createdAt: 1 }).populate('user', 'name username profilePicture verificationStatus role institution').lean();
  const order = { pending: 0, accepted: 1, rejected: 2 };
  regs.sort((a, b) => order[a.status] - order[b.status]);
  res.json({
    registrations: regs,
    counts: { pending: regs.filter((r) => r.status === 'pending').length, accepted: regs.filter((r) => r.status === 'accepted').length, rejected: regs.filter((r) => r.status === 'rejected').length },
    maxParticipants: quiz.settings?.maxParticipants ?? 0,
  });
});

/**
 * POST /quizzes/:id/registrations { ids, action: accept|reject } - decide requests (one or many).
 * Accepted members are added to the test (they can open it and start once it's live) and told.
 */
export const decideRegistrations = asyncHandler(async (req, res) => {
  const quiz = await ownListedQuiz(req);
  const accept = req.body.action === 'accept';
  const regs = await QuizRegistration.find({ _id: { $in: req.body.ids }, quiz: quiz._id, status: { $ne: accept ? 'accepted' : 'rejected' } });
  if (!regs.length) return res.json({ changed: 0 });
  if (accept && quiz.settings?.maxParticipants) {
    const already = await QuizRegistration.countDocuments({ quiz: quiz._id, status: 'accepted' });
    if (already + regs.length > quiz.settings.maxParticipants) {
      throw ApiError.badRequest(`That's more than the ${quiz.settings.maxParticipants} participants this test allows (${already} accepted). Raise the limit in Edit > Settings, or accept fewer.`);
    }
  }
  const now = new Date();
  const userIds = regs.map((r) => r.user);
  await QuizRegistration.updateMany({ _id: { $in: regs.map((r) => r._id) } }, { status: accept ? 'accepted' : 'rejected', decidedAt: now });
  await Quiz.updateOne(
    { _id: quiz._id },
    accept ? { $addToSet: { invitedUsers: { $each: userIds }, joinedUsers: { $each: userIds } } } : { $pull: { invitedUsers: { $in: userIds }, joinedUsers: { $in: userIds } } }
  );
  const note = accept
    ? `You're registered for "${quiz.title}". It opens ${ist(quiz.startTime)}; start it from the test's page then.`
    : `Your request to take "${quiz.title}" was declined by the organizer.`;
  await Promise.all(userIds.map((u) => notifyQuiz({ recipient: u, sourceUser: req.user._id, type: 'quiz_registration', quiz: quiz._id, note, link: `/quiz/${quiz._id}/details` })));
  // the host's own "N requests waiting" notification is done once nothing waits
  if (!(await QuizRegistration.exists({ quiz: quiz._id, status: 'pending' }))) {
    await Notification.updateMany({ recipient: req.user._id, type: 'quiz_request', quiz: quiz._id }, { isRead: true });
  }
  const what = regs.length === 1 ? 'Request' : `${regs.length} requests`;
  res.json({ changed: regs.length, message: `${what} ${accept ? 'accepted' : 'declined'}` });
});
