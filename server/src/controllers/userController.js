import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { saveFile, getPrivateAccess } from '../utils/storage.js';
import { assertFile, MAX_IMAGE_BYTES, MAX_DOCUMENT_BYTES } from '../middleware/upload.js';
import { createNotification, removeNotification } from '../utils/notify.js';
import { AUTHOR_FIELDS, escapeRegex } from '../utils/serializers.js';
import { getFeed } from './postController.js';
import { syncAuthorBoost } from '../utils/premium.js';
import { ACTIVE_USER } from '../utils/visibility.js';
import { assertNotBlocked, relationFlags, invalidateBlockedBy, hiddenAuthorsFor } from '../utils/blocking.js';
import { normalizeReport, reportSummary } from '../utils/moderation.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { topBadgesFor, topContributorsByWard, rankingExcludedIds } from '../utils/rankings.js';
import { wardBySlug } from '../data/wards.js';
import { stateOfInstitution, collegesInState } from '../data/colleges.js';


function profileShape(user, viewer) {
  const o = user.toJSON();
  const isSelf = viewer && String(viewer._id) === String(user._id);
  return {
    ...o,
    followerCount: user.followers.length,
    followingCount: user.following.length,
    isFollowing: Boolean(viewer && user.followers.some((id) => String(id) === String(viewer._id))),
    isSelf: Boolean(isSelf),
    followers: undefined,
    following: undefined,
    // Only the owner sees their own account details and settings.
    email: isSelf ? o.email : undefined,
    isAdmin: isSelf ? o.isAdmin : undefined,
    preferences: isSelf ? o.preferences : undefined,
    hasPassword: isSelf ? o.hasPassword : undefined,
    usesGoogle: isSelf ? o.usesGoogle : undefined,
    acceptedTermsAt: isSelf ? o.acceptedTermsAt : undefined,
    termsVersion: isSelf ? o.termsVersion : undefined,
    quizHost: isSelf ? o.quizHost : undefined,
    appShortcut: isSelf ? o.appShortcut : undefined,
    appShortcutAt: undefined,
    deactivatedAt: undefined,
  };
}

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+isDemo');
  if (!user || user.deactivatedAt) throw ApiError.notFound('User not found');
  const [stats] = await Post.aggregate([
    { $match: { author: user._id } },
    {
      $group: {
        _id: null,
        postCount: { $sum: 1 },
        caseCount: { $sum: { $cond: [{ $eq: ['$type', 'case_study'] }, 1, 0] } },
        notesCount: { $sum: { $cond: [{ $eq: ['$type', 'notes'] }, 1, 0] } },
        likesReceived: { $sum: { $size: '$likes' } },
        savesReceived: { $sum: { $size: '$bookmarks' } },
      },
    },
  ]);
  const { _id, ...counts } = stats ?? { postCount: 0, caseCount: 0, notesCount: 0, likesReceived: 0, savesReceived: 0 };
  // "Top Contributor" badges: the Wards where they're currently #1.
  const topIn = await topBadgesFor(user._id);
  // Admins see which profiles are demo accounts (to use them); nobody else does.
  const demo = req.user?.isAdmin && user.isDemo ? { isDemo: true } : {};
  res.json({ user: { ...profileShape(user, req.user), ...counts, topIn, ...demo, ...relationFlags(req.user, user) } });
});

/** Mute / unmute someone: their posts leave your feeds. Private; they aren't told. */
export const toggleMute = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  if (String(targetId) === String(req.user._id)) throw ApiError.badRequest("You can't mute yourself");
  if (!(await User.exists({ _id: targetId }))) throw ApiError.notFound('User not found');
  const muted = req.user.muted.some((id) => String(id) === String(targetId));
  await User.updateOne({ _id: req.user._id }, muted ? { $pull: { muted: targetId } } : { $addToSet: { muted: targetId } });
  res.json({ muted: !muted });
});

/** Block / unblock someone. Blocking also removes any follows between you. */
export const toggleBlock = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const meId = req.user._id;
  if (String(targetId) === String(meId)) throw ApiError.badRequest("You can't block yourself");
  if (!(await User.exists({ _id: targetId }))) throw ApiError.notFound('User not found');
  const blocked = req.user.blocked.some((id) => String(id) === String(targetId));
  if (blocked) {
    await User.updateOne({ _id: meId }, { $pull: { blocked: targetId } });
  } else {
    await Promise.all([
      User.updateOne({ _id: meId }, { $addToSet: { blocked: targetId }, $pull: { following: targetId, followers: targetId } }),
      User.updateOne({ _id: targetId }, { $pull: { following: meId, followers: meId } }),
    ]);
  }
  invalidateBlockedBy(targetId); // their feeds hide (or show again) my posts from the next request
  res.json({ blocked: !blocked });
});

/** Report a profile to the moderators (lands in Moderation > Help requests). */
export const reportUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id).select('name');
  if (!target) throw ApiError.notFound('User not found');
  if (String(target._id) === String(req.user._id)) throw ApiError.badRequest("You can't report yourself");
  await SupportTicket.create({
    user: req.user._id,
    category: 'content',
    message: `Profile reported: ${target.name} (/profile/${target._id})\nReason: ${reportSummary(normalizeReport(req.body))}`,
  });
  res.json({ message: 'Thanks. Our moderators will review this account.' });
});

export const updateUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only edit your own profile');
  }
  const user = req.user;
  const { name, role, bio, institution, designation, specialtyTags, course, country, username, yearLabel } = req.body;

  if (username !== undefined && username !== user.username) {
    if (await User.exists({ username, _id: { $ne: user._id } })) throw ApiError.conflict(`@${username} is already taken`);
    user.username = username;
  }
  if (yearLabel !== undefined) user.yearLabel = yearLabel;
  if (name !== undefined) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (institution !== undefined) user.institution = institution;
  if (course !== undefined) user.course = course;
  if (country !== undefined) user.country = country;
  if (designation !== undefined) user.designation = designation;
  // Specialist titles (Cardiologist, MD Medicine…) belong to doctors; other roles show their role badge.
  if (user.role !== 'doctor') user.designation = '';
  // The year line ("MBBS 2nd Prof") is for students.
  if (user.role !== 'student') user.yearLabel = '';
  if (specialtyTags !== undefined) user.specialtyTags = specialtyTags;
  let tickChanged = false;
  if (role !== undefined && role !== user.role) {
    user.role = role;
    // A verification applies to the role it was granted for.
    if (user.verificationStatus === 'verified') {
      user.verificationStatus = 'unverified';
      tickChanged = true;
    }
  }

  const avatarFile = req.files?.profilePicture?.[0];
  if (avatarFile) {
    assertFile(avatarFile, { maxBytes: MAX_IMAGE_BYTES, label: 'Profile picture' });
    user.profilePicture = (await saveFile(avatarFile, { folder: 'avatars' })).url;
  }

  const coverFile = req.files?.coverPhoto?.[0];
  if (coverFile) {
    assertFile(coverFile, { maxBytes: MAX_IMAGE_BYTES, label: 'Cover photo' });
    user.coverPhoto = (await saveFile(coverFile, { folder: 'covers' })).url;
  } else if (req.body.removeCover === 'true') {
    user.coverPhoto = '';
  }

  await user.save();
  if (tickChanged) await syncAuthorBoost(user);
  res.json({ user: user.toJSON() });
});

export const toggleFollow = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const me = req.user;
  if (String(targetId) === String(me._id)) throw ApiError.badRequest("You can't follow yourself");

  const target = await User.findById(targetId).select('_id');
  if (!target) throw ApiError.notFound('User not found');
  await assertNotBlocked(me._id, target._id, "You can't follow this account");

  const isFollowing = me.following.some((id) => String(id) === String(targetId));
  if (isFollowing) {
    await Promise.all([
      User.updateOne({ _id: me._id }, { $pull: { following: target._id } }),
      User.updateOne({ _id: target._id }, { $pull: { followers: me._id } }),
    ]);
    await removeNotification({ recipient: target._id, type: 'follow', sourceUser: me._id });
  } else {
    await Promise.all([
      User.updateOne({ _id: me._id }, { $addToSet: { following: target._id } }),
      User.updateOne({ _id: target._id }, { $addToSet: { followers: me._id } }),
    ]);
    await createNotification({ recipient: target._id, type: 'follow', sourceUser: me._id });
  }

  const updated = await User.findById(target._id).select('followers');
  res.json({ following: !isFollowing, followerCount: updated.followers.length });
});

export const submitVerification = asyncHandler(async (req, res) => {
  if (String(req.params.id) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only verify your own account');
  }
  if (!req.file) throw ApiError.badRequest('Please attach a verification document (PDF, JPG or PNG)');
  if (req.user.verificationStatus === 'verified') throw ApiError.badRequest('Your account is already verified');

  assertFile(req.file, { maxBytes: MAX_DOCUMENT_BYTES, label: 'Document' });
  const { url } = await saveFile(req.file, { folder: 'verification', isPrivate: true });

  await User.updateOne(
    { _id: req.user._id },
    { verificationStatus: 'pending', verificationDocumentUrl: url }
  );
  res.json({ verificationStatus: 'pending', message: 'Document received - we will review it shortly' });
});

/** Streams (local) or redirects to a short-lived signed URL (Cloudinary). Owner or admin only. */
export const getVerificationDocument = asyncHandler(async (req, res) => {
  const isOwner = String(req.params.id) === String(req.user._id);
  if (!isOwner && !req.user.isAdmin) throw ApiError.forbidden();

  const user = await User.findById(req.params.id).select('+verificationDocumentUrl');
  const access = getPrivateAccess(user?.verificationDocumentUrl);
  if (!access) throw ApiError.notFound('No verification document on file');

  res.set('Cache-Control', 'private, no-store');
  if (access.redirectUrl) return res.redirect(access.redirectUrl);
  res.sendFile(access.filePath);
});

// Reuses the feed controller's filtering/pagination, scoped to one user:
// their own posts, or (?reposts=true) the posts they reposted.
export const getUserPosts = (req, res, next) => {
  if (req.validatedQuery.reposts) req.validatedQuery.repostedBy = req.params.id;
  else req.validatedQuery.author = req.params.id;
  return getFeed(req, res, next);
};

/** GET /users/:id/followers|following?page=&limit= - newest first, one page at a time. */
const listConnections = (field) =>
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
    // One query reads just this page of ids (newest first) and the total, not the whole list.
    const list = { $ifNull: [`$${field}`, []] };
    const [row] = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
      { $project: { deactivatedAt: 1, total: { $size: list }, ids: { $slice: [{ $reverseArray: list }, (page - 1) * limit, limit] } } },
    ]);
    if (!row || row.deactivatedAt) throw ApiError.notFound('User not found');
    const { ids, total } = row;
    const people = await User.find({ _id: { $in: ids }, ...ACTIVE_USER }).select(AUTHOR_FIELDS + ' bio').lean();
    const byId = new Map(people.map((p) => [String(p._id), p]));
    res.json({ users: ids.map((id) => byId.get(String(id))).filter(Boolean), page, total, hasMore: page * limit < total });
  });

export const getFollowers = listConnections('followers');
export const getFollowing = listConnections('following');

/** GET /users/me/following-ids -> { ids } - who I follow, for Follow buttons (ids only, fetched when needed). */
export const getMyFollowingIds = asyncHandler(async (req, res) => {
  res.json({ ids: (req.user.following ?? []).map(String) });
});

/** People who can be @mentioned (for the mention picker). Respects "Allow others to mention me". */
export const searchMentionable = asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 40);
  if (!q) return res.json({ users: [] });
  const users = await User.find({
    _id: { $ne: req.user._id },
    name: { $regex: escapeRegex(q), $options: 'i' },
    'preferences.allowMentions': { $ne: false },
    ...ACTIVE_USER,
  })
    .select('name role designation profilePicture verificationStatus isPremium institution')
    .limit(6);
  res.json({ users });
});

/**
 * "Who to follow": 3-5 people, each with a reason line. Picked in turn from these groups so the
 * box mixes them:
 *   1. top contributors in Wards I joined, opened or posted in ("Top in Pharmacology")
 *   2. same college ("Same college")          3. same MBBS year ("Same year as you")
 *   4. same state, for known colleges ("From Maharashtra")
 *   5. most followers, then most cases ("Popular on Tectum")
 * then the newest members while the community is small. Each group is shuffled with a seed of
 * my id + today's date, so the names change from day to day but stay put within a day.
 * Never me, people I follow, muted / blocked (either way), deactivated, or demo accounts when
 * HIDE_DEMO_IN_RANKINGS is on. Only public profile fields are sent (never email or preferences).
 */
const SUGGEST_COUNT = 5;
const SUGGEST_FIELDS = `${AUTHOR_FIELDS} bio`;
const GROUP_LIMIT = 40;
const YEAR_REASON = { 1: '1st year, like you', 2: '2nd year, like you', 3: '3rd year, like you', final: 'Final year, like you', intern: 'Intern, like you', pg: 'PG, like you' };

/** Small seeded random generator (mulberry32) so a day's shuffle is repeatable. */
function seededRandom(seedText) {
  let a = [...seedText].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (list, rand) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const getSuggestions = asyncHandler(async (req, res) => {
  const me = req.user;
  const toId = (id) => new mongoose.Types.ObjectId(String(id));
  const [blockedEtc, rankingHidden] = await Promise.all([hiddenAuthorsFor(me), rankingExcludedIds()]);
  const exclude = [me._id, ...(me.following ?? []), ...blockedEtc, ...rankingHidden].map(toId);
  const base = { _id: { $nin: exclude }, ...ACTIVE_USER };
  const ids = (rows) => rows.map((r) => String(r._id));

  // 1. My Wards: joined, opened, or posted in.
  const postedIn = await Post.distinct('tags', { author: me._id });
  const myWards = [...new Set([...(me.wards ?? []), ...(me.wardVisits ? [...me.wardVisits.keys()] : []), ...postedIn])].filter(wardBySlug);
  const top = myWards.length ? await topContributorsByWard() : new Map();
  const wardReason = new Map();
  for (const slug of myWards) {
    for (const r of top.get(slug) ?? []) {
      if (!wardReason.has(String(r.user))) wardReason.set(String(r.user), `Top in ${wardBySlug(slug).label}`);
    }
  }

  // 2-4. Same college, same year, same state; 5. most followers / cases.
  const state = stateOfInstitution(me.institution);
  const sameStateColleges = state ? collegesInState(state).filter((n) => n.toLowerCase() !== me.institution.trim().toLowerCase()) : [];
  const [sameCollege, sameYear, sameState, byFollowers, byCases] = await Promise.all([
    me.institution?.trim()
      ? User.find({ ...base, institution: { $regex: `^${escapeRegex(me.institution.trim())}$`, $options: 'i' } }).select('_id').limit(GROUP_LIMIT).lean()
      : [],
    me.role === 'student' && me.studyYear ? User.find({ ...base, role: 'student', studyYear: me.studyYear }).select('_id').limit(GROUP_LIMIT).lean() : [],
    sameStateColleges.length ? User.find({ ...base, institution: { $in: sameStateColleges } }).select('_id').limit(GROUP_LIMIT).lean() : [],
    User.aggregate([
      { $match: base },
      { $project: { n: { $size: { $ifNull: ['$followers', []] } } } },
      { $match: { n: { $gt: 0 } } },
      { $sort: { n: -1 } },
      { $limit: 15 },
    ]),
    Post.aggregate([
      { $match: { type: 'case_study', author: { $nin: exclude }, 'privacyReview.removeAt': { $exists: false } } },
      { $group: { _id: '$author', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 15 },
    ]),
  ]);

  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); // IST date
  const rand = seededRandom(`${me._id}:${today}`);
  const groups = [
    { ids: [...wardReason.keys()], reason: (id) => wardReason.get(id) },
    { ids: ids(sameCollege), reason: () => 'Same college' },
    { ids: ids(sameYear), reason: () => YEAR_REASON[me.studyYear] ?? 'Same year as you' },
    { ids: ids(sameState), reason: () => `From ${state}` },
    { ids: [...new Set([...ids(byFollowers), ...ids(byCases)])], reason: () => 'Popular on Tectum' },
  ].map((g) => ({ ...g, ids: shuffled(g.ids, rand) }));

  // Take one from each group in turn, so the box mixes the reasons.
  const picked = new Map(); // id -> reason
  for (let round = 0; picked.size < SUGGEST_COUNT && groups.some((g) => g.ids.length); round += 1) {
    for (const g of groups) {
      while (g.ids.length && picked.size < SUGGEST_COUNT) {
        const id = g.ids.shift();
        if (!picked.has(id)) {
          picked.set(id, g.reason(id));
          break;
        }
      }
    }
  }
  if (picked.size < SUGGEST_COUNT) {
    // Few active members yet: the newest ones.
    const newest = await User.find({ ...base, _id: { $nin: [...exclude, ...[...picked.keys()].map(toId)] } }).select('_id').sort({ createdAt: -1 }).limit(SUGGEST_COUNT).lean();
    for (const u of newest) if (picked.size < SUGGEST_COUNT) picked.set(String(u._id), 'New on Tectum');
  }

  const chosen = [...picked.keys()].map(toId);
  const [people, fRows, cRows] = await Promise.all([
    User.find({ _id: { $in: chosen } }).select(SUGGEST_FIELDS),
    User.aggregate([{ $match: { _id: { $in: chosen } } }, { $project: { n: { $size: { $ifNull: ['$followers', []] } } } }]),
    Post.aggregate([{ $match: { type: 'case_study', author: { $in: chosen } } }, { $group: { _id: '$author', n: { $sum: 1 } } }]),
  ]);
  const followers = new Map(fRows.map((r) => [String(r._id), r.n]));
  const cases = new Map(cRows.map((r) => [String(r._id), r.n]));
  const byId = new Map(people.map((u) => [String(u._id), u]));
  res.json({
    users: [...picked.entries()]
      .filter(([id]) => byId.has(id))
      .map(([id, reason]) => ({ ...byId.get(id).toJSON(), reason, followerCount: followers.get(id) ?? 0, caseCount: cases.get(id) ?? 0 })),
  });
});

/** Save my academic portfolio. Each section sent replaces that section; sections left out stay as they are. */
export const updatePortfolio = asyncHandler(async (req, res) => {
  const $set = {};
  for (const key of ['publications', 'electives', 'presentations', 'certifications']) {
    if (req.body[key] !== undefined) $set[`portfolio.${key}`] = req.body[key];
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set }, { returnDocument: 'after', runValidators: true });
  res.json({ portfolio: user.toJSON().portfolio });
});