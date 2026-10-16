import mongoose from 'mongoose';
import { Activity, logActivity } from '../models/Activity.js';
import { WARD_SLUGS } from '../data/wards.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const WINDOW_DAYS = 370; // enough for this month, the current streak and the best streak this year

/** The member's time zone (IANA name from the browser), or UTC if it's missing or unknown. */
function zoneOf(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}
const dayIn = (date, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const prevDay = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const byDay = (tz, field) => ({ $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: tz } });

/**
 * GET /users/me/activity?tz=Asia/Kolkata
 * Per-day counts of what the member did (cases solved, flashcards revised, posts shared, answers),
 * plus the current and best streak. A day counts toward the streak if they did at least one of those.
 */
export const getActivity = asyncHandler(async (req, res) => {
  const tz = zoneOf(req.query.tz);
  const me = req.user._id;
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);

  const [logs, posts, comments] = await Promise.all([
    Activity.aggregate([
      { $match: { user: me, at: { $gte: since } } },
      { $group: { _id: { day: byDay(tz, 'at'), type: '$type' }, n: { $sum: '$count' } } },
    ]),
    Post.aggregate([
      { $match: { author: me, createdAt: { $gte: since } } },
      {
        $group: {
          _id: byDay(tz, 'createdAt'),
          posts: { $sum: 1 },
          cases: { $sum: { $cond: [{ $eq: ['$type', 'case_study'] }, 1, 0] } },
          pearls: { $sum: { $cond: [{ $eq: ['$kind', 'pearl'] }, 1, 0] } },
        },
      },
    ]),
    Comment.aggregate([
      { $match: { author: me, createdAt: { $gte: since } } },
      { $group: { _id: byDay(tz, 'createdAt'), n: { $sum: 1 } } },
    ]),
  ]);

  const days = {};
  const at = (day) => (days[day] ??= { solved: 0, reviewed: 0, posts: 0, cases: 0, pearls: 0, answers: 0 });
  for (const l of logs) at(l._id.day)[l._id.type === 'solve' ? 'solved' : 'reviewed'] += l.n;
  for (const p of posts) Object.assign(at(p._id), { posts: p.posts, cases: p.cases, pearls: p.pearls });
  for (const c of comments) at(c._id).answers = c.n;

  const active = (d) => {
    const x = days[d];
    return Boolean(x && (x.solved || x.reviewed || x.posts || x.answers));
  };
  const today = dayIn(new Date(), tz);
  // Today doesn't break the streak until it's over: count back from yesterday if nothing yet today.
  let streak = 0;
  for (let d = active(today) ? today : prevDay(today); active(d); d = prevDay(d)) streak++;
  let best = 0;
  let run = 0;
  let last = null;
  for (const d of Object.keys(days).filter(active).sort()) {
    run = last && prevDay(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }

  res.json({ today, timezone: tz, streak, best: Math.max(best, streak), days });
});

/**
 * GET /users/:id/study-stats - public study summary for a profile:
 * cases solved (voted or revealed), poll accuracy, and per-specialty progress (solved, accuracy),
 * with the weakest specialties flagged (at least 2 answers and under 60% correct).
 */
export const getStudyStats = asyncHandler(async (req, res) => {
  const user = new mongoose.Types.ObjectId(req.params.id);
  const solvedFilter = { type: 'case_study', $or: [{ solvedBy: user }, { 'pollVotes.user': user }] };
  const [solved, rows] = await Promise.all([
    Post.countDocuments(solvedFilter),
    Post.aggregate([
      { $match: solvedFilter },
      {
        $project: {
          tags: 1,
          vote: { $first: { $filter: { input: { $ifNull: ['$pollVotes', []] }, cond: { $eq: ['$$this.user', user] } } } },
          correct: '$caseStudy.correctOption',
        },
      },
      { $project: { tags: 1, answered: { $cond: [{ $ifNull: ['$vote', false] }, 1, 0] }, right: { $cond: [{ $and: [{ $ifNull: ['$vote', false] }, { $eq: ['$vote.option', '$correct'] }] }, 1, 0] } } },
      { $unwind: '$tags' },
      { $match: { tags: { $in: [...WARD_SLUGS] } } },
      { $group: { _id: '$tags', solved: { $sum: 1 }, answered: { $sum: '$answered' }, right: { $sum: '$right' } } },
      { $sort: { solved: -1 } },
    ]),
  ]);
  // Overall accuracy counts each voted case once (not once per tag).
  const [overall] = await Post.aggregate([
    { $match: { type: 'case_study', 'pollVotes.user': user } },
    { $project: { vote: { $first: { $filter: { input: '$pollVotes', cond: { $eq: ['$$this.user', user] } } } }, correct: '$caseStudy.correctOption' } },
    { $group: { _id: null, answered: { $sum: 1 }, right: { $sum: { $cond: [{ $eq: ['$vote.option', '$correct'] }, 1, 0] } } } },
  ]);
  const specialties = rows.map((r) => ({
    slug: r._id,
    solved: r.solved,
    answered: r.answered,
    accuracy: r.answered ? Math.round((r.right / r.answered) * 100) : null,
    weak: r.answered >= 2 && r.right / r.answered < 0.6,
  }));
  res.json({
    solved,
    answered: overall?.answered ?? 0,
    accuracy: overall?.answered ? Math.round((overall.right / overall.answered) * 100) : null,
    specialties,
  });
});

/** POST /users/me/activity/review { count } — flashcards revised (e.g. "Got it" swipes). */
export const recordReview = asyncHandler(async (req, res) => {
  const count = Number(req.body?.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 50) throw ApiError.badRequest('Invalid count');
  await logActivity(req.user._id, 'review', { count });
  res.json({ ok: true });
});
