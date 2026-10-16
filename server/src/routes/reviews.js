import { Router } from 'express';
import mongoose from 'mongoose';
import { Post } from '../models/Post.js';
import { ReviewCard, GRADES, schedule } from '../models/ReviewCard.js';
import { logActivity } from '../models/Activity.js';
import { protect } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { AUTHOR_FIELDS, serializePost } from '../utils/serializers.js';

/**
 * Spaced-repetition revision of the Notebook (saved posts). Every saved post is a flashcard;
 * one never reviewed is "new" and due now.
 *  GET  /api/reviews/summary          -> { due, total }
 *  GET  /api/reviews/due?limit=&tag=   -> { posts: [...due posts, oldest due first], due, total }
 *  POST /api/reviews/:postId { grade } -> { card }  (grade: again | hard | good | easy)
 */
const router = Router();
router.use(protect);

/** Saved post ids (optionally in one subject), with each one's card if it has been reviewed. */
async function deck(userId, tag) {
  const saved = await Post.find({ bookmarks: userId, ...(tag ? { tags: tag } : {}) }).select('_id').lean();
  const ids = saved.map((p) => p._id);
  const cards = await ReviewCard.find({ user: userId, post: { $in: ids } }).lean();
  const byPost = new Map(cards.map((c) => [String(c.post), c]));
  return ids.map((id) => ({ id, card: byPost.get(String(id)) ?? null }));
}

const isDue = (entry, now) => !entry.card || entry.card.due <= now;

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const all = await deck(req.user._id);
    res.json({ due: all.filter((e) => isDue(e, now)).length, total: all.length });
  })
);

router.get(
  '/due',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const tag = typeof req.query.tag === 'string' && /^[a-z0-9-]{1,40}$/.test(req.query.tag) ? req.query.tag : null;
    const all = await deck(req.user._id, tag);
    const due = all
      .filter((e) => isDue(e, now))
      // overdue reviews first, then new cards
      .sort((a, b) => (a.card?.due ?? Infinity) - (b.card?.due ?? Infinity));
    const ids = due.slice(0, limit).map((e) => e.id);
    const posts = await Post.find({ _id: { $in: ids } }).populate('author', AUTHOR_FIELDS);
    const order = new Map(ids.map((id, i) => [String(id), i]));
    posts.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
    // Flashcards need their backs: saved cases come with the answer (grading one records the reveal below).
    res.json({ posts: posts.map((p) => serializePost(p, req.user, { showAnswers: true })), due: due.length, total: all.length });
  })
);

router.post(
  '/:postId',
  validateObjectId('postId'),
  asyncHandler(async (req, res) => {
    const grade = req.body?.grade;
    if (!GRADES.includes(grade)) throw ApiError.badRequest('Grade must be again, hard, good or easy');
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const saved = await Post.exists({ _id: postId, bookmarks: req.user._id });
    if (!saved) throw ApiError.notFound('Save this post to your Notebook to revise it');
    const current = await ReviewCard.findOne({ user: req.user._id, post: postId }).lean();
    const next = schedule(current, grade);
    const card = await ReviewCard.findOneAndUpdate({ user: req.user._id, post: postId }, { $set: next }, { upsert: true, returnDocument: 'after' }).lean();
    // Grading a case's flashcard means its answer was seen: it counts as revealed (\"solved\").
    Post.updateOne({ _id: postId, type: 'case_study' }, { $addToSet: { solvedBy: req.user._id } }).catch(() => {});
    // counts toward today's "Revise 5 flashcards" goal and the streak
    logActivity(req.user._id, 'review', { post: postId });
    res.json({ card: { due: card.due, interval: card.interval, reps: card.reps } });
  })
);

export default router;
