import { Router } from 'express';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { Comment } from '../models/Comment.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { verificationDecisionSchema, hostDecisionSchema } from '../validators.js';
import { listHostApplications, decideHostApplication } from '../controllers/quizHostController.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { AUTHOR_FIELDS } from '../utils/serializers.js';
import { syncAuthorBoost } from '../utils/premium.js';
import { startSession } from '../utils/token.js';
import { notifyFromTectum } from '../utils/notify.js';
import { REPORT_LABELS, HIDE_AFTER } from '../utils/moderation.js';
import { removePost } from '../controllers/postController.js';
import { removeComment } from '../controllers/commentController.js';
import { invalidateHiddenUsers } from '../utils/visibility.js';
import { hideDemoInRankings, setHideDemoInRankings } from '../utils/rankings.js';

const router = Router();
router.use(protect, requireAdmin);

/** The moderators' queue: reported posts and reported replies (hidden ones first). */
router.get(
  '/reports',
  asyncHandler(async (_req, res) => {
    const [posts, comments] = await Promise.all([
      Post.find({ reported: true })
        .sort({ hiddenByReports: -1, updatedAt: -1 })
        .limit(100)
        .populate('author', AUTHOR_FIELDS)
        .populate('reports.user', 'name'),
      Comment.find({ reported: true })
        .sort({ hiddenByReports: -1, createdAt: -1 })
        .limit(100)
        .populate('author', AUTHOR_FIELDS)
        .populate('reports.user', 'name')
        .populate('post', 'type title caseStudy.chiefComplaint'),
    ]);
    res.json({ posts, comments, labels: REPORT_LABELS, hideAfter: HIDE_AFTER });
  })
);

/** Keep: the reports are cleared and a hidden post shows again. */
router.post(
  '/reports/:id/dismiss',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const post = await Post.findByIdAndUpdate(req.params.id, { reported: false, reports: [], hiddenByReports: false }, { returnDocument: 'after' });
    if (!post) throw ApiError.notFound('Post not found');
    res.json({ message: 'Report dismissed' });
  })
);

router.post(
  '/comment-reports/:id/dismiss',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const c = await Comment.findByIdAndUpdate(req.params.id, { reported: false, $unset: { reports: 1 }, hiddenByReports: false }, { returnDocument: 'after' });
    if (!c) throw ApiError.notFound('Reply not found');
    res.json({ message: 'Report dismissed' });
  })
);

router.delete(
  '/posts/:id',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');
    const title = (post.title || post.caseStudy?.chiefComplaint || post.content || '').replace(/==/g, '').slice(0, 80);
    await removePost(post);
    if (post.reported) {
      await notifyFromTectum({ recipient: post.author, type: 'content_removed', note: `A moderator removed your post "${title}" after reports from members.` });
    }
    res.json({ message: 'Post removed' });
  })
);

router.delete(
  '/comments/:id',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw ApiError.notFound('Reply not found');
    await removeComment(comment);
    await notifyFromTectum({ recipient: comment.author, type: 'content_removed', note: `A moderator removed your reply "${comment.text.slice(0, 80)}" after reports from members.` });
    res.json({ message: 'Reply removed' });
  })
);

// ---- members: totals, sign-ups, activity and the latest photos ----
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get(
  '/members',
  asyncHandler(async (req, res) => {
    const DAY = 86400 * 1000;
    const now = Date.now();
    // "Today" starts at midnight India time (IST, UTC+5:30), whatever the server's own clock zone.
    const IST = 5.5 * 3600 * 1000;
    const startOfToday = new Date(new Date(now + IST).setUTCHours(0, 0, 0, 0) - IST);
    const weekAgo = new Date(now - 7 * DAY);
    const q = String(req.query.q ?? '').trim().slice(0, 80);
    const filter = q ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }] } : {};
    // ?who=real hides demo accounts, ?who=demo shows only them.
    if (req.query.who === 'real') filter.isDemo = { $ne: true };
    else if (req.query.who === 'demo') filter.isDemo = true;

    const [total, demo, newToday, newWeek, activeToday, activeWeek, posts, postsToday, photoPosts, members, photos] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isDemo: true }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.countDocuments({ lastActiveAt: { $gte: new Date(now - DAY) } }),
      User.countDocuments({ lastActiveAt: { $gte: weekAgo } }),
      Post.countDocuments(),
      Post.countDocuments({ createdAt: { $gte: startOfToday } }),
      Post.countDocuments({ 'images.0': { $exists: true } }),
      User.find(filter)
        .select('name username email role course country profilePicture verificationStatus isAdmin isOfficial quizHost deactivatedAt createdAt +lastLoginAt +lastActiveAt +isDemo +quizBanned +quizFlags')
        .sort({ createdAt: -1 })
        .limit(300)
        .lean(),
      Post.find({ 'images.0': { $exists: true } })
        .select('images author createdAt title content')
        .sort({ createdAt: -1 })
        .limit(24)
        .populate('author', 'name')
        .lean(),
    ]);

    const counts = await Post.aggregate([
      { $match: { author: { $in: members.map((m) => m._id) } } },
      { $group: { _id: '$author', n: { $sum: 1 } } },
    ]);
    const postCount = new Map(counts.map((c) => [String(c._id), c.n]));
    for (const m of members) m.postCount = postCount.get(String(m._id)) ?? 0;

    res.json({ stats: { total, demo, newToday, newWeek, activeToday, activeWeek, posts, postsToday, photoPosts }, members, photos, hideDemo: await hideDemoInRankings() });
  })
);

/**
 * PUT /admin/users/:id/quiz-ban { banned } - block (or unblock) a member from taking tests.
 * Only site admins can do this - organizers can't, and disqualifications never do it on their own
 * (unless AUTO_BAN_ON_DISQUALIFICATION=true).
 */
router.put(
  '/users/:id/quiz-ban',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    if (typeof req.body?.banned !== 'boolean') throw ApiError.badRequest('banned must be true or false');
    const user = await User.findByIdAndUpdate(req.params.id, { quizBanned: req.body.banned }, { returnDocument: 'after' }).select('name +quizBanned');
    if (!user) throw ApiError.notFound('Member not found');
    console.log(`[admin] ${req.user.email} ${user.quizBanned ? 'blocked' : 'unblocked'} ${user._id} (${user.name}) from tests`);
    res.json({ quizBanned: user.quizBanned });
  })
);

// ---- applications to conduct tests (Moderation > Quiz hosts) ----
router.get('/quiz-hosts', listHostApplications);
router.post('/quiz-hosts/:id', validateObjectId('id'), validate(hostDecisionSchema), decideHostApplication);

/** PUT /admin/settings/hide-demo { hidden } - show or hide demo accounts in Top Contributors and Who to follow. */
router.put(
  '/settings/hide-demo',
  asyncHandler(async (req, res) => {
    if (typeof req.body?.hidden !== 'boolean') throw ApiError.badRequest('hidden must be true or false');
    const hidden = await setHideDemoInRankings(req.body.hidden, req.user._id);
    res.json({ hidden });
  })
);

/**
 * POST /admin/demo/:id/use - an admin steps into a DEMO account (scripts/seed-demo) to edit
 * anything with the normal screens. Only accounts flagged isDemo; real members can never be
 * entered. The admin's own session stays saved in this browser, so switching back is one tap.
 */
router.post(
  '/demo/:id/use',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('+isDemo');
    if (!user) throw ApiError.notFound('Member not found');
    if (!user.isDemo) throw ApiError.forbidden('Only demo accounts can be used this way');
    if (user.deactivatedAt) {
      user.deactivatedAt = null;
      await user.save();
      invalidateHiddenUsers();
    }
    const token = startSession(res, user, req);
    console.log(`[admin] ${req.user.email} is now using demo account ${user._id} (${user.name})`);
    res.json({ user: { ...user.toJSON(), isDemo: true }, token });
  })
);

/** PUT /admin/members/:id/official { official } - mark an account as an official Tectum account (or not). */
router.put(
  '/members/:id/official',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.id, { isOfficial: req.body?.official === true }, { returnDocument: 'after' }).select('name isOfficial');
    if (!user) throw ApiError.notFound('Member not found');
    res.json({ user });
  })
);

// ---- help requests from the Settings > Help form ----
router.get(
  '/support',
  asyncHandler(async (req, res) => {
    const status = req.query.status === 'resolved' ? 'resolved' : 'open';
    const tickets = await SupportTicket.find({ status })
      .sort({ createdAt: status === 'open' ? 1 : -1 })
      .limit(200)
      .populate('user', 'name email role profilePicture verificationStatus isPremium');
    res.json({ tickets });
  })
);

router.post(
  '/support/:id/resolve',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status: 'resolved', resolvedAt: new Date() }, { returnDocument: 'after' });
    if (!ticket) throw ApiError.notFound('Request not found');
    res.json({ ticket });
  })
);

router.get(
  '/verifications',
  asyncHandler(async (_req, res) => {
    const users = await User.find({ verificationStatus: 'pending' })
      .select('name email role designation institution specialtyTags profilePicture createdAt verificationStatus verifiedVia verifiedAt')
      .sort({ updatedAt: 1 })
      .limit(200);
    res.json({ users });
  })
);

router.post(
  '/verifications/:id',
  validateObjectId('id'),
  validate(verificationDecisionSchema),
  asyncHandler(async (req, res) => {
    const approved = req.body.status === 'verified';
    const user = await User.findByIdAndUpdate(
      req.params.id,
      approved
        ? { verificationStatus: 'verified', verifiedVia: 'admin', verifiedAt: new Date() }
        : { verificationStatus: 'unverified', $unset: { verifiedVia: '', verifiedAt: '' } },
      { returnDocument: 'after' }
    );
    if (!user) throw ApiError.notFound('User not found');
    await syncAuthorBoost(user); // blue tick shows (and ranks) only while verified
    // The member hears the result in their notifications.
    const note = approved
      ? 'You are verified - your blue tick is now on your profile.'
      : 'We could not verify the document. You can upload a clearer one in Settings > Verification.';
    await notifyFromTectum({ recipient: user._id, type: 'verification', note });
    res.json({ user });
  })
);

export default router;
