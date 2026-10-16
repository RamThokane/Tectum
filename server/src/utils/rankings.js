import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { SiteSetting } from '../models/SiteSetting.js';
import { WARDS, wardBySlug } from '../data/wards.js';
import { getHiddenUserIds } from './visibility.js';

/**
 * Top Contributors settings. A member's score in a Ward over the last WINDOW_DAYS:
 *   (posts + cases in that Ward) x ITEM_WEIGHT + likes those posts received x LIKE_WEIGHT
 * HIDE_DEMO_IN_RANKINGS leaves demo accounts (User.isDemo, scripts/seed-demo) out of Top
 * Contributors and Who to follow without deleting them. Admins switch it in Moderation > Members
 * (SiteSetting 'hideDemoInRankings'); until they do, the env var of the same name, then this default, applies.
 */
export const RANKING = {
  WINDOW_DAYS: 30,
  ITEM_WEIGHT: 3,
  LIKE_WEIGHT: 1,
  TOP_N: 5,
  HIDE_DEMO_IN_RANKINGS: false,
  CACHE_MS: 10 * 60_000,
};

const defaultHideDemo = () =>
  process.env.HIDE_DEMO_IN_RANKINGS != null ? process.env.HIDE_DEMO_IN_RANKINGS === 'true' : RANKING.HIDE_DEMO_IN_RANKINGS;

const HIDE_DEMO_KEY = 'hideDemoInRankings';
let hideDemoCache = null; // { value, expires }

/** Whether demo accounts are hidden from Top Contributors and Who to follow (admin switch, cached 30 s). */
export async function hideDemoInRankings() {
  if (hideDemoCache && hideDemoCache.expires > Date.now()) return hideDemoCache.value;
  const row = await SiteSetting.findOne({ key: HIDE_DEMO_KEY }).select('enabled').lean();
  const value = typeof row?.enabled === 'boolean' ? row.enabled : defaultHideDemo();
  hideDemoCache = { value, expires: Date.now() + 30_000 };
  return value;
}

/** Admin switch: saves the choice and clears the cached lists so it applies at once. */
export async function setHideDemoInRankings(hidden, adminId) {
  await SiteSetting.updateOne({ key: HIDE_DEMO_KEY }, { $set: { enabled: Boolean(hidden), updatedBy: adminId } }, { upsert: true });
  hideDemoCache = null;
  cache = null;
  return Boolean(hidden);
}

/** Accounts left out of rankings and suggestions: deactivated ones, plus demo ones when hidden. */
export async function rankingExcludedIds() {
  const hidden = await getHiddenUserIds();
  if (!(await hideDemoInRankings())) return hidden;
  const demo = await User.find({ isDemo: true }).distinct('_id');
  return [...hidden, ...demo];
}

/**
 * Top contributors of every Ward in one aggregation: Map(slug -> [{ user, posts, cases, likes, score }]),
 * best first. Shared by all members and recomputed at most every CACHE_MS, so the lists move
 * as the window slides and new members become active.
 */
let cache = null; // { map, expires, pending }

export async function topContributorsByWard() {
  if (cache?.map && cache.expires > Date.now()) return cache.map;
  if (cache?.pending) return cache.pending;
  const pending = computeTop()
    .then((map) => {
      cache = { map, expires: Date.now() + RANKING.CACHE_MS };
      return map;
    })
    .catch((err) => {
      cache = null;
      throw err;
    });
  cache = { ...cache, pending };
  return pending;
}

/** Forget the cached lists (used by the demo seed and tests). */
export const invalidateRankings = () => {
  cache = null;
  hideDemoCache = null;
};

async function computeTop() {
  const slugs = WARDS.map((w) => w.slug);
  const since = new Date(Date.now() - RANKING.WINDOW_DAYS * 86400000);
  const excluded = await rankingExcludedIds();
  const rows = await Post.aggregate([
    {
      $match: {
        tags: { $in: slugs },
        createdAt: { $gte: since },
        author: { $nin: excluded },
        'privacyReview.removeAt': { $exists: false },
        hiddenByReports: { $ne: true },
      },
    },
    { $project: { author: 1, type: 1, tags: 1, likes: { $size: { $ifNull: ['$likes', []] } } } },
    { $unwind: '$tags' },
    { $match: { tags: { $in: slugs } } },
    {
      $group: {
        _id: { ward: '$tags', author: '$author' },
        items: { $sum: 1 },
        cases: { $sum: { $cond: [{ $eq: ['$type', 'case_study'] }, 1, 0] } },
        likes: { $sum: '$likes' },
      },
    },
    { $addFields: { score: { $add: [{ $multiply: ['$items', RANKING.ITEM_WEIGHT] }, { $multiply: ['$likes', RANKING.LIKE_WEIGHT] }] } } },
    { $sort: { score: -1, likes: -1, '_id.author': 1 } },
    {
      $group: {
        _id: '$_id.ward',
        top: { $push: { author: '$_id.author', items: '$items', cases: '$cases', likes: '$likes', score: '$score' } },
      },
    },
    { $project: { top: { $slice: ['$top', RANKING.TOP_N] } } },
  ]);
  return new Map(
    rows.map((r) => [r._id, r.top.map((t) => ({ user: t.author, posts: t.items - t.cases, cases: t.cases, likes: t.likes, score: t.score }))])
  );
}

/** Wards where this member is currently #1: [{ slug, label }]. */
export async function topBadgesFor(userId) {
  const map = await topContributorsByWard();
  const id = String(userId);
  return [...map.entries()]
    .filter(([, list]) => list.length && String(list[0].user) === id)
    .map(([slug]) => ({ slug, label: wardBySlug(slug)?.label ?? slug }));
}
