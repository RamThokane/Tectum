import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { Notification } from '../models/Notification.js';
import { NotebookNote } from '../models/NotebookNote.js';
import { Activity } from '../models/Activity.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { clearAuthCookie, readSavedTokens, writeSavedTokens, withoutAccount, startSession } from '../utils/token.js';
import { ReviewCard } from '../models/ReviewCard.js';
import { QuizRegistration, QuizHostApplication } from '../models/QuizHost.js';
import { BCRYPT_ROUNDS } from './authController.js';
import { deleteFile } from '../utils/storage.js';
import { ChatKey, Conversation, Message } from '../models/Chat.js';
import { WARD_SLUGS } from '../data/wards.js';
import { invalidateHiddenUsers } from '../utils/visibility.js';

/** Loads the signed-in user with their password hash and checks the given password. */
async function confirmPassword(userId, password, { confirm, word } = {}) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.badRequest('Password is incorrect');
  if (!user.passwordSet) {
    // Google account with no password of its own: typing the word (DELETE / DEACTIVATE) confirms.
    if (word && confirm === word) return user;
    throw ApiError.badRequest(word ? `Type ${word} to confirm` : 'Set a password for this account first (Settings > Password), then try again.');
  }
  if (!password) throw ApiError.badRequest('Enter your password to confirm');
  if (!(await bcrypt.compare(password, user.password))) {
    throw ApiError.badRequest('Password is incorrect');
  }
  return user;
}

export const changePassword = asyncHandler(async (req, res) => {
  const existing = await User.findById(req.user._id).select('+password');
  // Google members choose their first password without a current one.
  const isFirstPassword = existing?.passwordSet === false;
  const user = isFirstPassword ? existing : await confirmPassword(req.user._id, req.body.currentPassword);
  user.password = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS);
  user.passwordSet = true;
  user.tokenVersion += 1; // signs out every other device
  await user.save();
  const token = startSession(res, user, req); // keep this device signed in
  res.json({
    message: isFirstPassword
      ? 'Password set. You can now log in with your email as well as Google.'
      : 'Password changed. Other devices have been signed out.',
    token,
  });
});

export const changeEmail = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await confirmPassword(req.user._id, password);
  if (email === user.email) throw ApiError.badRequest('That is already your email');
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  user.email = email;
  await user.save();
  res.json({ user: user.toJSON(), message: 'Email updated' });
});

export const logoutEverywhere = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } }, { returnDocument: 'after' });
  const token = startSession(res, user, req);
  res.json({ message: 'Signed out of all other devices', token });
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const { notifications, showSensitive, allowMentions } = req.body;
  const $set = {};
  Object.entries(notifications ?? {}).forEach(([k, v]) => ($set[`preferences.notifications.${k}`] = v));
  if (showSensitive !== undefined) $set['preferences.showSensitive'] = showSensitive;
  if (allowMentions !== undefined) $set['preferences.allowMentions'] = allowMentions;
  const user = await User.findByIdAndUpdate(req.user._id, { $set }, { returnDocument: 'after' });
  res.json({ user: user.toJSON() });
});

/**
 * PUT /users/me/app-shortcut { status: 'later' | 'installed' } - the member's answer to "Add Tectum
 * to your home screen". Once installed it stays installed (a later "later" from another device
 * doesn't bring the reminder back).
 */
export const updateAppShortcut = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const filter = status === 'later' ? { _id: req.user._id, appShortcut: { $ne: 'installed' } } : { _id: req.user._id };
  await User.updateOne(filter, { $set: { appShortcut: status, appShortcutAt: new Date() } });
  const user = await User.findById(req.user._id).select('appShortcut').lean();
  res.json({ appShortcut: user?.appShortcut ?? null });
});

/**
 * POST /users/me/onboarding - the first-login welcome steps: role (+ year or specialty title),
 * interests, Wards to join and a daily goal. `skip: true` just marks them done.
 * Interests are added to the profile's specialties and Wards are joined (existing ones kept).
 */
export const completeOnboarding = asyncHandler(async (req, res) => {
  const { skip, role, studyYear, designation, interests, wards, dailyGoal } = req.body;
  const user = await User.findById(req.user._id);
  if (!skip) {
    if (role) user.role = role;
    if (studyYear && role === 'student') user.studyYear = studyYear;
    if (designation !== undefined && role !== 'student') user.designation = designation;
    if (interests?.length) user.specialtyTags = [...new Set([...(user.specialtyTags ?? []), ...interests])].slice(0, 20);
    const valid = (wards ?? []).filter((s) => WARD_SLUGS.has(s));
    if (valid.length) {
      const joined = new Set(user.wards ?? []);
      const now = new Date();
      for (const s of valid) {
        if (!joined.has(s)) user.wardVisits.set(s, now); // nothing old counts as "new" when you join
        joined.add(s);
      }
      user.wards = [...joined];
    }
    if (dailyGoal) user.preferences.dailyGoal = dailyGoal;
  }
  user.onboardedAt = new Date();
  await user.save();
  res.json({ user: user.toJSON() });
});

/** Everything we store about the user, as a downloadable JSON file. */
export const exportData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [posts, comments, bookmarks, following, followers] = await Promise.all([
    Post.find({ author: userId }).select('-likes -reposts -bookmarks -reports -rankAt').lean(),
    Comment.find({ author: userId }).lean(),
    Post.find({ bookmarks: userId }).select('_id title type createdAt').lean(),
    User.find({ _id: { $in: req.user.following } }).select('name').lean(),
    User.find({ _id: { $in: req.user.followers } }).select('name').lean(),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    profile: { ...req.user.toJSON(), followers: undefined, following: undefined },
    following: following.map((u) => u.name),
    followers: followers.map((u) => u.name),
    posts,
    comments,
    savedPosts: bookmarks,
  };
  res.set('Content-Disposition', `attachment; filename="tectum-data-${new Date().toISOString().slice(0, 10)}.json"`);
  res.set('Cache-Control', 'private, no-store');
  res.type('application/json').send(JSON.stringify(data, null, 2));
});

/** Hides the account everywhere and signs out all devices. Logging in again reactivates it. */
export const deactivateAccount = asyncHandler(async (req, res) => {
  const user = await confirmPassword(req.user._id, req.body.password, { confirm: req.body.confirm, word: 'DEACTIVATE' });
  user.deactivatedAt = new Date();
  user.tokenVersion += 1; // sign out every device
  await user.save();
  invalidateHiddenUsers();
  clearAuthCookie(res);
  writeSavedTokens(res, withoutAccount(readSavedTokens(req), user._id));
  res.json({ message: 'Your account is deactivated. Log in any time to reactivate it.' });
});

/** Permanently removes the account and everything it created. */
export const deleteAccount = asyncHandler(async (req, res) => {
  const user = await confirmPassword(req.user._id, req.body.password, { confirm: req.body.confirm, word: 'DELETE' });
  const userId = user._id;

  // Collect every file this member uploaded so it can be removed from storage too.
  const [withDoc, ownPosts] = await Promise.all([
    User.findById(userId).select('+verificationDocumentUrl').lean(),
    Post.find({ author: userId }).select('images notesFile.url').lean(),
  ]);
  const files = [
    user.profilePicture,
    user.coverPhoto,
    withDoc?.verificationDocumentUrl,
    ...ownPosts.flatMap((p) => [...(p.images ?? []), p.notesFile?.url]),
  ].filter(Boolean);

  const postIds = ownPosts.map((p) => p._id);
  // Comments this user left on other people's posts: decrement those posts' counters.
  const theirComments = await Comment.aggregate([
    { $match: { author: userId, post: { $nin: postIds } } },
    { $group: { _id: '$post', n: { $sum: 1 } } },
  ]);

  await Promise.all([
    ...theirComments.map((c) => Post.updateOne({ _id: c._id }, { $inc: { commentCount: -c.n } })),
    Comment.deleteMany({ $or: [{ author: userId }, { post: { $in: postIds } }] }),
    Notification.deleteMany({ $or: [{ recipient: userId }, { sourceUser: userId }, { post: { $in: postIds } }] }),
    Post.deleteMany({ author: userId }),
    Post.updateMany({}, { $pull: { likes: userId, reposts: userId, bookmarks: userId, solvedBy: userId } }),
    NotebookNote.deleteMany({ $or: [{ user: userId }, { post: { $in: postIds } }] }),
    Activity.deleteMany({ user: userId }),
    ReviewCard.deleteMany({ user: userId }),
    // tests: their registrations (name, college) and applications to conduct tests (phone etc.)
    QuizRegistration.deleteMany({ user: userId }),
    QuizHostApplication.deleteMany({ user: userId }),
    User.updateMany({}, { $pull: { followers: userId, following: userId } }),
  ]);
  // Encrypted chats: remove their key and every conversation they were in (both sides).
  const convIds = await Conversation.find({ members: userId }).distinct('_id');
  await Promise.all([
    ChatKey.deleteOne({ user: userId }),
    Message.deleteMany({ conversation: { $in: convIds } }),
    Conversation.deleteMany({ _id: { $in: convIds } }),
  ]);
  await User.deleteOne({ _id: userId });
  await Promise.all(files.map(deleteFile));

  clearAuthCookie(res);
  writeSavedTokens(res, withoutAccount(readSavedTokens(req), userId));
  res.json({ message: 'Your account has been deleted' });
});
