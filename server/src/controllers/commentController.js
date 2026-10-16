import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { createNotification } from '../utils/notify.js';
import { AUTHOR_FIELDS, serializeComment } from '../utils/serializers.js';
import { getHiddenUserIds } from '../utils/visibility.js';
import { resolveMentions, notifyMentions } from '../utils/mentions.js';
import { canReplyTo } from '../utils/replyPolicy.js';
import { assertNotBlocked, hiddenAuthorsFor } from '../utils/blocking.js';
import { addReport, normalizeReport, visibleTo } from '../utils/moderation.js';
import { assertNoObviousPHI } from '../utils/phi.js';
import { PRIVACY_RULES_VERSION } from '../utils/privacy.js';

export const addComment = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.postId).select('author replyPolicy mentions');
  if (!post) throw ApiError.notFound('Post not found');
  if (!(await canReplyTo(post, req.user))) throw ApiError.forbidden("The author has limited who can reply to this post");
  await assertNotBlocked(req.user._id, post.author, "You can't reply to this account");

  // A reply to a reply joins the same thread: replies always hang off the top-level comment.
  let parent = null;
  let repliedTo = null;
  if (req.body.parentId) {
    const target = await Comment.findOne({ _id: req.body.parentId, post: post._id }).select('author parent');
    if (!target) throw ApiError.notFound('The comment you replied to was deleted');
    parent = target.parent ?? target._id;
    repliedTo = target.author;
  }

  assertNoObviousPHI(req.body.text); // no patient identifiers, and no asking for them
  const { text, mentionedIds } = await resolveMentions(req.body.text);
  const comment = await Comment.create({ post: post._id, author: req.user._id, text, parent, privacyChecked: PRIVACY_RULES_VERSION });
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
  await comment.populate('author', AUTHOR_FIELDS);

  const source = { sourceUser: req.user._id, post: post._id };
  if (repliedTo) await createNotification({ recipient: repliedTo, type: 'reply', ...source });
  // Replying to the post's author already told them; everyone else gets one alert each.
  if (!repliedTo || String(repliedTo) !== String(post.author)) {
    await createNotification({ recipient: post.author, type: 'comment', ...source });
  }
  const alerted = [post.author, repliedTo].filter(Boolean).map(String);
  await notifyMentions(mentionedIds.filter((id) => !alerted.includes(String(id))), source);
  res.status(201).json({ comment: serializeComment(comment, req.user._id) });
});

/** Comments flagged for patient privacy or hidden after reports are seen only by their author. */
const privacyVisible = visibleTo;

export const listComments = asyncHandler(async (req, res) => {
  const { page, limit } = req.validatedQuery;
  const [hidden, blocked] = await Promise.all([getHiddenUserIds(), hiddenAuthorsFor(req.user, { includeMuted: false })]);
  const filter = { post: req.params.postId, author: { $nin: [...hidden, ...blocked] }, ...privacyVisible(req.user?._id) };
  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS),
    Comment.countDocuments(filter),
  ]);
  res.json({ comments: comments.map((c) => serializeComment(c, req.user?._id)), page, total, hasMore: page * limit < total });
});

/** Like / repost / save toggles on a comment. Responds with the new count and whether it's now on. */
const toggleOnComment = (field) =>
  asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const comment = await Comment.findOne({ _id: req.params.commentId, post: req.params.postId }).select(field);
    if (!comment) throw ApiError.notFound('Comment not found');
    const on = comment[field].some((id) => String(id) === String(userId));
    const updated = await Comment.findByIdAndUpdate(
      comment._id,
      on ? { $pull: { [field]: userId } } : { $addToSet: { [field]: userId } },
      { returnDocument: 'after' }
    ).select(field);
    res.json({ count: updated[field].length, active: !on });
  });

export const toggleCommentLike = toggleOnComment('likes');
export const toggleCommentRepost = toggleOnComment('reposts');
export const toggleCommentBookmark = toggleOnComment('bookmarks');

// The post each listed comment belongs to, trimmed to what a preview needs.
const POST_PREVIEW = { path: 'post', select: 'type title content caseStudy.chiefComplaint author', populate: { path: 'author', select: 'name' } };

/** Comments a member has reposted (shown on their profile's Reposts tab). */
export const listRepostedComments = asyncHandler(async (req, res) => {
  const hidden = await getHiddenUserIds();
  const comments = await Comment.find({ reposts: req.params.id, author: { $nin: hidden }, ...privacyVisible(req.user?._id) })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('author', AUTHOR_FIELDS)
    .populate(POST_PREVIEW);
  res.json({ comments: comments.filter((c) => c.post).map((c) => serializeComment(c, req.user?._id)) });
});

/** Comments the signed-in member saved (Saved > Replies). */
export const listSavedComments = asyncHandler(async (req, res) => {
  const hidden = await getHiddenUserIds();
  const comments = await Comment.find({ bookmarks: req.user._id, author: { $nin: hidden }, ...privacyVisible(req.user._id) })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('author', AUTHOR_FIELDS)
    .populate(POST_PREVIEW);
  res.json({ comments: comments.filter((c) => c.post).map((c) => serializeComment(c, req.user._id)) });
});

/**
 * POST /posts/:postId/comments/:commentId/report { reason, details? } - into the moderators' queue
 * (Moderation > Reported); hidden after enough members report it.
 */
export const reportComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({ _id: req.params.commentId, post: req.params.postId }).select('post author reports hiddenByReports');
  if (!comment) throw ApiError.notFound('Comment not found');
  if (String(comment.author) === String(req.user._id)) throw ApiError.badRequest("You can't report your own reply");
  const { already } = await addReport(Comment, comment, req.user._id, normalizeReport(req.body), { kind: 'comment', postId: comment.post ?? req.params.postId });
  res.json({ message: already ? 'You have already reported this reply' : 'Thanks. Our moderators will review this reply.' });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({ _id: req.params.commentId, post: req.params.postId });
  if (!comment) throw ApiError.notFound('Comment not found');
  if (String(comment.author) !== String(req.user._id) && !req.user.isAdmin) {
    throw ApiError.forbidden('You can only delete your own comments');
  }
  const removed = await removeComment(comment);
  res.json({ message: 'Comment deleted', id: comment._id, removed });
});

/** Deletes a comment (a top-level one takes its replies with it); returns how many went. Also used by the privacy sweep. */
export async function removeComment(comment) {
  const { deletedCount: replies } = comment.parent ? { deletedCount: 0 } : await Comment.deleteMany({ parent: comment._id });
  await comment.deleteOne();
  const removed = 1 + replies;
  await Post.updateOne(
    { _id: comment.post },
    [{ $set: { commentCount: { $max: [0, { $subtract: ['$commentCount', removed] }] } } }],
    { updatePipeline: true }
  );
  return removed;
}
