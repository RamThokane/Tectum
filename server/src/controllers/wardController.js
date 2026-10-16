import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getHiddenUserIds } from '../utils/visibility.js';
import { hiddenAuthorsFor } from '../utils/blocking.js';
import { AUTHOR_FIELDS } from '../utils/serializers.js';
import { WARDS, WARD_SLUGS, wardBySlug } from '../data/wards.js';
import { topContributorsByWard, RANKING } from '../utils/rankings.js';

// Posts newer than this count as "new" in a Ward the member joined but has never opened.
const FIRST_VISIT_WINDOW_MS = 7 * 86400000;
const MAX_NEW = 99;

const assertWard = (slug) => {
  const ward = wardBySlug(slug);
  if (!ward) throw ApiError.notFound('Ward not found');
  return ward;
};

/** Member counts per Ward (active accounts only). */
async function memberCounts(slugs) {
  const rows = await User.aggregate([
    { $match: { deactivatedAt: null, wards: { $in: slugs } } },
    { $unwind: '$wards' },
    { $match: { wards: { $in: slugs } } },
    { $group: { _id: '$wards', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
}

/** "New since your last visit" for each joined Ward, not counting your own posts. */
async function newCounts(user, hidden) {
  const visits = user.wardVisits ?? new Map();
  const counts = await Promise.all(
    (user.wards ?? []).map(async (slug) => {
      const since = visits.get(slug) ?? new Date(Date.now() - FIRST_VISIT_WINDOW_MS);
      const n = await Post.countDocuments({ tags: slug, createdAt: { $gt: since }, author: { $nin: [user._id, ...hidden] } }).limit(MAX_NEW);
      return [slug, n];
    })
  );
  return new Map(counts);
}

/** A few members of each Ward (newest joiners first) for the avatar stack on Ward cards. */
async function sampleMembers(slugs, perWard = 3) {
  const rows = await User.aggregate([
    { $match: { deactivatedAt: null, wards: { $in: slugs } } },
    { $sort: { updatedAt: -1 } },
    { $unwind: '$wards' },
    { $match: { wards: { $in: slugs } } },
    { $group: { _id: '$wards', people: { $push: { _id: '$_id', name: '$name', profilePicture: '$profilePicture' } } } },
    { $project: { people: { $slice: ['$people', perWard] } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.people]));
}

/**
 * Every Ward, with member / post counts, when it was last active, a few members' avatars,
 * whether I joined it and how many posts are new to me.
 */
// The parts every member sees the same (member / post counts, last activity, faces) change slowly
// and cost three aggregations, so they're shared for a minute. Joining a Ward clears it.
const WARD_STATS_TTL_MS = 60_000;
let wardStats = null; // { members, posts, faces, expires, pending }

async function sharedWardStats(hidden) {
  if (wardStats?.members && wardStats.expires > Date.now()) return wardStats;
  if (wardStats?.pending) return wardStats.pending;
  const slugs = WARDS.map((w) => w.slug);
  const pending = Promise.all([
    memberCounts(slugs),
    Post.aggregate([
      { $match: { tags: { $in: slugs }, author: { $nin: hidden } } },
      { $unwind: '$tags' },
      { $match: { tags: { $in: slugs } } },
      { $group: { _id: '$tags', n: { $sum: 1 }, last: { $max: '$createdAt' } } },
    ]),
    sampleMembers(slugs),
  ])
    .then(([members, postRows, faces]) => {
      wardStats = { members, posts: new Map(postRows.map((r) => [r._id, r])), faces, expires: Date.now() + WARD_STATS_TTL_MS };
      return wardStats;
    })
    .catch((err) => {
      wardStats = null;
      throw err;
    });
  wardStats = { ...wardStats, pending };
  return pending;
}

export const listWards = asyncHandler(async (req, res) => {
  const hidden = await getHiddenUserIds();
  const [{ members, posts, faces }, fresh] = await Promise.all([sharedWardStats(hidden), newCounts(req.user, hidden)]);
  const joined = new Set(req.user.wards ?? []);
  // Personal (joined / new counts): only this browser may keep it, and it must check back each
  // time (joining a Ward changes it). Express adds an ETag, so an unchanged list is a tiny 304.
  res.set('Cache-Control', 'private, no-cache');
  res.json({
    wards: WARDS.map((w) => ({
      ...w,
      members: members.get(w.slug) ?? 0,
      posts: posts.get(w.slug)?.n ?? 0,
      lastActiveAt: posts.get(w.slug)?.last ?? null,
      sampleMembers: faces.get(w.slug) ?? [],
      joined: joined.has(w.slug),
      newCount: fresh.get(w.slug) ?? 0,
    })),
  });
});

/** One Ward: header details and top contributors. */
export const getWard = asyncHandler(async (req, res) => {
  const ward = assertWard(req.params.slug);
  const hidden = (await Promise.all([getHiddenUserIds(), hiddenAuthorsFor(req.user)])).flat();
  const inWard = { tags: ward.slug, author: { $nin: hidden } };

  const [members, posts, top] = await Promise.all([memberCounts([ward.slug]), Post.countDocuments(inWard), topContributorsByWard()]);

  // The shared top 5 (see utils/rankings.js), minus anyone this member blocked or muted.
  const hiddenSet = new Set(hidden.map(String));
  const contributorRows = (top.get(ward.slug) ?? []).filter((r) => !hiddenSet.has(String(r.user)));
  const people = await User.find({ _id: { $in: contributorRows.map((r) => r.user) } }).select(AUTHOR_FIELDS);
  const byId = new Map(people.map((u) => [String(u._id), u]));

  res.json({
    ward: {
      ...ward,
      members: members.get(ward.slug) ?? 0,
      posts,
      joined: (req.user.wards ?? []).includes(ward.slug),
    },
    contributors: contributorRows
      .filter((r) => byId.has(String(r.user)))
      .map((r, i) => ({ user: byId.get(String(r.user)), rank: i + 1, posts: r.posts, cases: r.cases, likes: r.likes, score: r.score })),
    rankingWindowDays: RANKING.WINDOW_DAYS,
  });
});

/** Join or leave a Ward. Joining counts as a visit, so nothing old shows up as "new". */
export const toggleWard = asyncHandler(async (req, res) => {
  const ward = assertWard(req.params.slug);
  const joined = (req.user.wards ?? []).includes(ward.slug);
  const update = joined
    ? { $pull: { wards: ward.slug } }
    : { $addToSet: { wards: ward.slug }, $set: { [`wardVisits.${ward.slug}`]: new Date() } };
  const user = await User.findByIdAndUpdate(req.user._id, update, { returnDocument: 'after' });
  wardStats = null; // member counts changed
  const members = await memberCounts([ward.slug]);
  res.json({ joined: !joined, wards: user.wards, members: members.get(ward.slug) ?? 0 });
});

/** Opening a Ward clears its "new" dot. */
export const visitWard = asyncHandler(async (req, res) => {
  if (!WARD_SLUGS.has(req.params.slug)) throw ApiError.notFound('Ward not found');
  await User.updateOne({ _id: req.user._id }, { $set: { [`wardVisits.${req.params.slug}`]: new Date() } });
  res.json({ ok: true });
});
