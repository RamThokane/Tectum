import { Router } from 'express';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { SiteSetting } from '../models/SiteSetting.js';
import { WARDS } from '../data/wards.js';
import { asyncHandler } from '../utils/ApiError.js';
import { getHiddenUserIds } from '../utils/visibility.js';

/**
 * Public, logged-out data for the landing page. Only real numbers and real (de-identified,
 * already public to members) case content; nothing about who voted or who posted.
 */
const router = Router();

let cache = { at: 0, stats: null, sample: undefined };
const TTL = 5 * 60000;

/** GET /api/public/stats -> { cases, wards, specialties, members } (live counts, cached 5 min) */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    if (!cache.stats || Date.now() - cache.at > TTL) {
      const hidden = await getHiddenUserIds();
      const [cases, members, specialties] = await Promise.all([
        Post.countDocuments({ type: 'case_study', author: { $nin: hidden } }),
        User.countDocuments({ deactivatedAt: null }),
        Post.distinct('tags', { type: 'case_study', author: { $nin: hidden }, tags: { $in: WARDS.map((w) => w.slug) } }),
      ]);
      cache = { ...cache, at: Date.now(), stats: { cases, wards: WARDS.length, specialties: specialties.length, members } };
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json(cache.stats);
  })
);

/**
 * GET /api/public/sample-case -> the most-voted case with a diagnosis poll: the case text, the
 * options, real vote counts, the answer and its explanation. null if there's no such case yet.
 */
router.get(
  '/sample-case',
  asyncHandler(async (_req, res) => {
    if (cache.sample === undefined || Date.now() - cache.at > TTL) {
      const [hidden, chosen] = await Promise.all([getHiddenUserIds(), SiteSetting.findOne({ key: 'caseOfTheDay' }).lean()]);
      const [post] = await Post.aggregate([
        { $match: { type: 'case_study', author: { $nin: hidden }, 'caseStudy.pollOptions.1': { $exists: true }, isSensitiveContent: { $ne: true }, 'privacyReview.removeAt': { $exists: false }, hiddenByReports: { $ne: true } } },
        // The admin's Case of the Day comes first (if it has a poll), then the most-voted case.
        { $addFields: { voteN: { $size: { $ifNull: ['$pollVotes', []] } }, chosen: { $eq: ['$_id', chosen?.post ?? null] } } },
        { $sort: { chosen: -1, voteN: -1, createdAt: -1 } },
        { $limit: 1 },
        { $project: { title: 1, tags: 1, caseStudy: 1, pollVotes: 1 } },
      ]);
      let sample = null;
      if (post) {
        const cs = post.caseStudy;
        const counts = cs.pollOptions.map((_, i) => (post.pollVotes ?? []).filter((v) => v.option === i).length);
        sample = {
          id: post._id,
          title: post.title || cs.chiefComplaint,
          chiefComplaint: cs.chiefComplaint,
          age: cs.age,
          sex: cs.sex,
          history: cs.history,
          examination: cs.examinationFindings,
          investigations: cs.investigations,
          options: cs.pollOptions,
          correctOption: cs.correctOption,
          counts,
          total: counts.reduce((a, b) => a + b, 0),
          diagnosis: cs.diagnosis,
          learningPoint: cs.learningPoint,
          tags: post.tags,
        };
      }
      cache = { ...cache, at: cache.stats ? cache.at : Date.now(), sample };
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ sample: cache.sample });
  })
);

export default router;
