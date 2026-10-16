import { Router } from 'express';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { searchSchema, suggestSchema } from '../validators.js';
import { asyncHandler } from '../utils/ApiError.js';
import { AUTHOR_FIELDS, serializePost, escapeRegex, normalizeTag, truncateWords } from '../utils/serializers.js';
import { getHiddenUserIds, ACTIVE_USER } from '../utils/visibility.js';
import { QUOTED_COMMENT_POPULATE } from '../controllers/postController.js';

const router = Router();

const TITLE = '(?:(?:dr|prof|mr|mrs|ms)\\.?\\s+)?';

/**
 * GET /search/suggest?q=ma â€” type-ahead while the member is still typing, from the first letter.
 * Matches the start of any word ("mar" finds "Maria Khan" and "Anna Martin") and, for 2-5 letters,
 * initials ("mk" finds "Maria Khan", "Dr. Maria Khan").
 */
router.get(
  '/suggest',
  protect,
  validate(suggestSchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery.q.replace(/^[#@]/, '');
    if (!q) return res.json({ users: [], tags: [], posts: [] });
    const wordStart = new RegExp(`(^|[\\s\\-(/])${escapeRegex(q)}`, 'i');
    const letters = q.toLowerCase().replace(/[^a-z]/g, '');
    const initials =
      letters.length >= 2 && letters.length <= 5 && !/\s/.test(q)
        ? new RegExp(`^${TITLE}${letters.split('').join('\\S*\\s+')}`, 'i')
        : null;
    const tagPrefix = new RegExp(`^${escapeRegex(normalizeTag(q).replace(/\s+/g, '-'))}`, 'i');

    const hidden = await getHiddenUserIds();
    const [users, tagAgg, posts] = await Promise.all([
      User.find({ ...ACTIVE_USER, $or: [{ name: wordStart }, { username: new RegExp(`^${escapeRegex(q.toLowerCase())}`) }, ...(initials ? [{ name: initials }] : [])] })
        .limit(20)
        .select(AUTHOR_FIELDS),
      Post.aggregate([
        { $match: { tags: tagPrefix, author: { $nin: hidden } } },
        { $unwind: '$tags' },
        { $match: { tags: tagPrefix } },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Post.find({
        author: { $nin: hidden },
        'privacyReview.removeAt': { $exists: false }, // flagged for patient privacy
        hiddenByReports: { $ne: true }, // hidden after member reports
        // never a case's answer side: searching the diagnosis would give it away
        $or: [{ title: wordStart }, { 'caseStudy.chiefComplaint': wordStart }, { content: wordStart }],
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('type title content caseStudy.chiefComplaint tags createdAt'),
    ]);

    // Names that start with what was typed first, then other word matches, then initials.
    const rank = (u) => (new RegExp(`^${TITLE}${escapeRegex(q)}`, 'i').test(u.name) ? 0 : wordStart.test(u.name) ? 1 : 2);
    const people = users.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 6);

    res.json({
      users: people,
      tags: tagAgg.map((t) => ({ tag: t._id, count: t.count })),
      posts: posts.map((p) => ({
        _id: p._id,
        type: p.type,
        text: truncateWords((p.title || p.caseStudy?.chiefComplaint || p.content || '').replace(/@\[([^\]]+)\]\([a-f\d]{24}\)/gi, '@$1'), 120),
      })),
    });
  })
);

router.get(
  '/',
  protect,
  validate(searchSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { q } = req.validatedQuery;
    const text = { $text: { $search: q } };
    const score = { score: { $meta: 'textScore' } };
    const prefix = new RegExp(escapeRegex(normalizeTag(q)), 'i');

    const hidden = await getHiddenUserIds(); // deactivated accounts never appear in search
    const [users, posts, tagAgg] = await Promise.all([
      User.find({ ...text, ...ACTIVE_USER }, score).sort(score).limit(10).select('-followers -following'),
      Post.find({ ...text, author: { $nin: hidden }, 'privacyReview.removeAt': { $exists: false }, hiddenByReports: { $ne: true } }, score)
        .sort(score)
        .limit(30)
        .populate('author', AUTHOR_FIELDS)
        .populate({ path: 'quoteOf', select: 'author type title content images isSensitiveContent createdAt', populate: { path: 'author', select: AUTHOR_FIELDS } })
        .populate(QUOTED_COMMENT_POPULATE),
      Post.aggregate([
        { $match: { author: { $nin: hidden } } },
        { $unwind: '$tags' },
        { $match: { tags: prefix } },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Text search matches whole words only; fall back to a name prefix match for people.
    let people = users;
    if (people.length === 0) {
      people = await User.find({ name: new RegExp(escapeRegex(q), 'i'), ...ACTIVE_USER })
        .limit(10)
        .select('-followers -following');
    }

    res.json({
      users: people,
      posts: posts.map((p) => serializePost(p, req.user)),
      tags: tagAgg.map((t) => ({ tag: t._id, count: t.count })),
    });
  })
);

export default router;
