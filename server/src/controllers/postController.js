import mongoose from 'mongoose';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { Comment } from '../models/Comment.js';
import { Notification } from '../models/Notification.js';
import { NotebookNote } from '../models/NotebookNote.js';
import { SiteSetting } from '../models/SiteSetting.js';
import { logActivity } from '../models/Activity.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { saveFile } from '../utils/storage.js';
import { assertFile, MAX_IMAGE_BYTES, MAX_NOTES_BYTES, fileExt } from '../middleware/upload.js';
import { createNotification, removeNotification } from '../utils/notify.js';
import { assertNoObviousPHI } from '../utils/phi.js';
import { PRIVACY_RULES_VERSION } from '../utils/privacy.js';
import { reviewPrivacy } from '../utils/privacySweep.js';
import { rankAtFor, hasBlueTick } from '../utils/premium.js';
import { reviewImages } from '../utils/imageModeration.js';
import { getHiddenUserIds } from '../utils/visibility.js';
import { resolveMentions, notifyMentions } from '../utils/mentions.js';
import { canReplyTo } from '../utils/replyPolicy.js';
import { hiddenAuthorsFor } from '../utils/blocking.js';
import { addReport, normalizeReport, visibleTo } from '../utils/moderation.js';
import { MAX_POST_WORDS, MAX_POST_WORDS_BLUE, countWords } from '../validators.js';
import { AUTHOR_FIELDS, serializePost, serializeComment, escapeRegex, normalizeTag, caseAnswers } from '../utils/serializers.js';
import { recordViews } from '../utils/views.js';

/** What search may look at: a case's question side only (see CASE_ANSWER_FIELDS for the hidden side). */
export const SEARCH_FIELDS = ['title', 'content', 'tags', 'caseStudy.chiefComplaint', 'caseStudy.history', 'caseStudy.examinationFindings', 'caseStudy.investigations'];

// The quoted post (if any) comes along with just enough to render the embedded preview.
const QUOTED_FIELDS = 'author type title content caseStudy.chiefComplaint notesFile.fileName images isSensitiveContent createdAt';
// A quoted comment brings its author and a little of the post it was written on ("Replying to …").
export const QUOTED_COMMENT_POPULATE = {
  path: 'quoteOfComment',
  select: 'author text post createdAt',
  populate: [
    { path: 'author', select: AUTHOR_FIELDS },
    { path: 'post', select: 'title author', populate: { path: 'author', select: 'name' } },
  ],
};
const populateAuthor = (q) =>
  q.populate([
    { path: 'author', select: AUTHOR_FIELDS },
    { path: 'quoteOf', select: QUOTED_FIELDS, populate: { path: 'author', select: AUTHOR_FIELDS } },
    QUOTED_COMMENT_POPULATE,
  ]);

async function loadPost(id) {
  const post = await Post.findById(id);
  if (!post) throw ApiError.notFound('Post not found');
  return post;
}

/** Quick Post word limit: 500 words, or 5000 for blue tick members. */
function assertWordLimit(content, user) {
  const limit = hasBlueTick(user) ? MAX_POST_WORDS_BLUE : MAX_POST_WORDS;
  const words = countWords(content);
  if (words > limit) {
    const hint = limit === MAX_POST_WORDS ? ` Blue tick members can write up to ${MAX_POST_WORDS_BLUE} words.` : '';
    throw ApiError.badRequest(`A post can be at most ${limit} words (yours has ${words}).${hint}`);
  }
}

const assertOwner = (post, user) => {
  if (String(post.author) !== String(user._id)) throw ApiError.forbidden('You can only modify your own posts');
};

// ---------- create ----------
export const createPost = asyncHandler(async (req, res) => {
  const { type, kind, title, content, caseStudy, tags, isSensitiveContent, deidentified, replyPolicy, collab, quoteOf, quoteComment } = req.body;
  // Notes uploads were retired on 2026-09-24; existing notes posts stay readable.
  if (type === 'notes') throw ApiError.badRequest('Uploading notes is no longer available on Tectum');
  if ((quoteOf || quoteComment) && type !== 'text') throw ApiError.badRequest('Only a quick post can quote');
  if (quoteOf && quoteComment) throw ApiError.badRequest('Quote either a post or a comment, not both');
  const quoted = quoteOf ? await Post.findById(quoteOf).select('author') : null;
  if (quoteOf && !quoted) throw ApiError.notFound('The post you are quoting was deleted');
  const quotedComment = quoteComment ? await Comment.findById(quoteComment).select('author') : null;
  if (quoteComment && !quotedComment) throw ApiError.notFound('The comment you are quoting was deleted');
  const imageFiles = req.files?.images ?? [];
  const notesUpload = req.files?.notesFile?.[0];

  if (type === 'text') assertWordLimit(content, req.user);
  else if (content.length > 5000) throw ApiError.badRequest('Description can be at most 5000 characters');
  assertNoObviousPHI(title, content); // the case's own fields are checked below

  const doc = {
    author: req.user._id,
    type,
    kind: type === 'text' ? kind : 'discussion', // pearl / question only apply to quick posts
    title,
    content,
    tags,
    isSensitiveContent,
    replyPolicy,
    collab,
    rankAt: rankAtFor(req.user),
    privacyChecked: PRIVACY_RULES_VERSION, // passed the privacy check just below
  };

  if (type === 'case_study') {
    if (!caseStudy) throw ApiError.badRequest('Case study details are required');
    if (!deidentified) {
      throw ApiError.badRequest('Please confirm the case contains no patient-identifying information and that you have appropriate consent');
    }
    assertNoObviousPHI(caseStudy);
    doc.caseStudy = caseStudy;
  }

  if (type === 'notes') {
    if (!title || title.trim().length < 3) throw ApiError.badRequest('Please add a title for your notes (at least 3 characters)');
    if (!notesUpload) throw ApiError.badRequest('Please attach a notes file');
    assertFile(notesUpload, { maxBytes: MAX_NOTES_BYTES, label: 'Notes file' });
  } else if (notesUpload) {
    throw ApiError.badRequest('Only notes posts can include a notes file');
  }

  imageFiles.forEach((f) => assertFile(f, { maxBytes: MAX_IMAGE_BYTES, label: 'Image' }));

  // Clinical images: the poster confirms nothing identifies the patient and they have consent.
  if (imageFiles.length && !req.body.patientConsent && !(type === 'case_study' && deidentified)) {
    throw ApiError.badRequest('Please confirm the images contain no patient-identifying information and that you have appropriate consent');
  }

  // Copyright: uploaders must confirm the notes/images are theirs or shared with permission.
  if ((notesUpload || imageFiles.length) && !req.body.ownsRights) {
    throw ApiError.badRequest('Please confirm you made these files yourself or have permission to share them');
  }

  if (quoted) Object.assign(doc, { quoteOf: quoted._id, isQuote: true, quoteKind: 'post' });
  if (quotedComment) Object.assign(doc, { quoteOfComment: quotedComment._id, isQuote: true, quoteKind: 'comment' });
  if (type === 'text' && !content && imageFiles.length === 0 && !doc.isQuote) {
    throw ApiError.badRequest('Write something or attach an image');
  }

  // AI review runs before anything is stored, so a sensitive image is never visible unblurred.
  if (imageFiles.length) {
    const review = await reviewImages(imageFiles);
    if (review.blur) doc.isSensitiveContent = true; // AI can add the blur, never remove the poster's
    if (review.flag) doc.reported = true; // lands in the moderators' queue
    doc.aiReview = { status: review.status, reasons: review.reasons, model: review.model, checkedAt: new Date() };
  }

  // Validation passed - now upload.
  doc.images = await Promise.all(imageFiles.map((f) => saveFile(f, { folder: 'images' }).then((r) => r.url)));
  if (notesUpload) {
    const { url } = await saveFile(notesUpload, { folder: 'notes' });
    doc.notesFile = { url, fileName: notesUpload.originalname.slice(0, 200), fileType: fileExt(notesUpload) };
  }

  const mentions = await resolveMentions(doc.content);
  doc.content = mentions.text;
  doc.mentions = mentions.mentionedIds;

  const post = await Post.create(doc);
  await notifyMentions(mentions.mentionedIds, { sourceUser: req.user._id, post: post._id });
  if (quoted) {
    await Post.updateOne({ _id: quoted._id }, { $inc: { quoteCount: 1 } });
    // "quoted your post" links to the new quote post, which shows the original inside it.
    await createNotification({ recipient: quoted.author, type: 'quote', sourceUser: req.user._id, post: post._id });
  }
  if (quotedComment) {
    await Comment.updateOne({ _id: quotedComment._id }, { $inc: { quoteCount: 1 } });
    await createNotification({ recipient: quotedComment.author, type: 'quote', sourceUser: req.user._id, post: post._id });
  }
  await populateAuthor(post);
  res.status(201).json({ post: serializePost(post, req.user), aiReview: doc.aiReview ?? null });
});

// ---------- feed ----------
export const getFeed = asyncHandler(async (req, res) => {
  const { page, limit, following, bookmarked, q, specialty, type, tag, author, repostedBy, media, sort: sortBy, kinds, wards, grid, unsolved, collab, difficulty, anyTag } =
    req.validatedQuery;
  const viewerId = req.user?._id;
  const filter = {};
  const and = []; // extra conditions that could clash with a plain field or $or above

  if (following) {
    if (!req.user) throw ApiError.unauthorized();
    filter.author = { $in: [...req.user.following, req.user._id] };
  }
  if (bookmarked) {
    if (!req.user) throw ApiError.unauthorized();
    filter.bookmarks = req.user._id;
  }
  if (author) {
    if (!mongoose.isValidObjectId(author)) throw ApiError.badRequest('Invalid author');
    filter.author = author;
  }
  if (repostedBy) filter.reposts = repostedBy; // set by GET /users/:id/posts?reposts=true
  if (type) filter.type = type;
  if (tag) filter.tags = normalizeTag(tag);
  if (media) filter['images.0'] = { $exists: true };
  if (kinds?.length) {
    // Posts from before `kind` existed have no value stored; they're discussions.
    const orMissing = kinds.includes('discussion') ? [{ kind: { $exists: false } }] : [];
    and.push({ type: 'text', $or: [{ kind: { $in: kinds } }, ...orMissing] });
  }
  if (wards) {
    if (!req.user) throw ApiError.unauthorized();
    and.push({ tags: { $in: req.user.wards ?? [] } });
  }
  // Pearl grid: short pearls and picture posts (ECGs, X-rays, slides).
  if (grid) and.push({ type: 'text', $or: [{ kind: 'pearl' }, { 'images.0': { $exists: true } }] });
  if (collab) filter.collab = { $in: ['researchers', 'students'] };
  if (difficulty) filter['caseStudy.difficulty'] = difficulty;
  if (anyTag?.length) and.push({ tags: { $in: anyTag } });
  if (unsolved) {
    if (!req.user) throw ApiError.unauthorized();
    and.push({ solvedBy: { $ne: req.user._id } }, { 'pollVotes.user': { $ne: req.user._id } });
  }

  // Everything the filter still needs from the database is looked up at once (each lookup is a
  // network round trip, so doing them one after another made feeds slow).
  const words = (q ?? '').split(/\s+/).filter(Boolean).slice(0, 8);
  const rx = (word) => ({ $regex: escapeRegex(word), $options: 'i' });
  const wantsNotInterested = req.user && !author && !bookmarked && !repostedBy;
  const [deactivated, hiddenForMe, notedPerWord, specialists, mine] = await Promise.all([
    // Deactivated accounts' posts are hidden everywhere; blocked accounts (either way) and, outside
    // a person's own profile, muted accounts are hidden from this viewer.
    getHiddenUserIds(),
    hiddenAuthorsFor(req.user, { includeMuted: !author }),
    // In the Notebook, my own private note on a post counts as a search match too.
    bookmarked ? Promise.all(words.map((w) => NotebookNote.find({ user: viewerId, text: rx(w) }).distinct('post'))) : [],
    specialty ? User.find({ specialtyTags: { $regex: `^${escapeRegex(normalizeTag(specialty))}$`, $options: 'i' } }).distinct('_id') : null,
    // "Not interested" posts leave discovery feeds (they still show on profiles and in the Notebook).
    // The signed-in user doc already has the list (see middleware/auth.js).
    wantsNotInterested ? (Array.isArray(req.user.notInterested) ? req.user : User.findById(req.user._id).select('+notInterested').lean()) : null,
  ]);

  // Search (Community and Notebook): every word must appear in the post's text or tags. Only a
  // case's question side is searched, never its answer (diagnosis, learning point, MCQ tips),
  // or search would give the answer away.
  words.forEach((word, i) => {
    const noted = notedPerWord[i] ?? [];
    and.push({ $or: [...SEARCH_FIELDS.map((f) => ({ [f]: rx(word) })), ...(noted.length ? [{ _id: { $in: noted } }] : [])] });
  });
  if (specialty) filter.$or = [{ tags: normalizeTag(specialty) }, { author: { $in: specialists } }];
  const hidden = [...deactivated, ...hiddenForMe];
  if (hidden.length) and.push({ author: { $nin: hidden } });
  // Posts flagged for patient privacy or hidden after member reports are seen only by their
  // author until fixed / reviewed.
  and.push(...visibleTo(viewerId).$and);
  if (mine?.notInterested?.length) and.push({ _id: { $nin: mine.notInterested } });
  if (and.length) filter.$and = and;

  // Discovery feeds are ranked (blue-tick authors get a boost); personal lists stay chronological.
  const ranked = sortBy ? sortBy === 'ranked' : !following && !bookmarked && !author && !repostedBy;
  const sort =
    sortBy === 'discussed'
      ? { commentCount: -1, createdAt: -1, _id: -1 }
      : sortBy === 'downloads'
        ? { downloadCount: -1, createdAt: -1, _id: -1 }
        : ranked
        ? { rankAt: -1, _id: -1 }
        : { createdAt: -1, _id: -1 };

  const [posts, total] = await Promise.all([
    populateAuthor(
      Post.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
    ).lean(),
    Post.countDocuments(filter),
  ]);

  // Views are counted separately, when a card is actually seen (POST /posts/views).
  // In the Notebook, each saved post comes with the member's own private note.
  const notes = bookmarked && posts.length
    ? new Map((await NotebookNote.find({ user: viewerId, post: { $in: posts.map((p) => p._id) } })).map((n) => [String(n.post), n.text]))
    : null;
  res.json({
    posts: posts.map((p) => ({
      // The Notebook is the member's own revision deck: saved cases come with their answers (flashcard backs).
      ...serializePost(p, req.user, { showAnswers: !!bookmarked }),
      ...(notes ? { myNote: notes.get(String(p._id)) ?? '' } : {}),
    })),
    page,
    total,
    hasMore: page * limit < total,
    nextPage: page * limit < total ? page + 1 : null,
  });
});

/** Most-used tags (last 30 days, falling back to all time) for "Clinical Trends". */
export const getTrending = asyncHandler(async (_req, res) => {
  const hidden = await getHiddenUserIds();
  const pipeline = (since) => [
    { $match: { author: { $nin: hidden }, ...(since ? { createdAt: { $gte: since } } : {}) } },
    { $unwind: '$tags' },
    {
      $group: {
        _id: '$tags',
        posts: { $sum: 1 },
        interactions: { $sum: { $add: ['$commentCount', { $size: '$likes' }] } },
      },
    },
    { $sort: { posts: -1, interactions: -1 } },
    { $limit: 8 },
  ];
  let rows = await Post.aggregate(pipeline(new Date(Date.now() - 30 * 86400000)));
  if (rows.length < 4) rows = await Post.aggregate(pipeline());
  res.json({ trends: rows.map((r) => ({ tag: r._id, posts: r.posts, interactions: r.interactions })) });
});

/** Tags already used on Tectum that contain what's being typed, most used first (Tags box autocomplete). */
export const suggestTags = asyncHandler(async (req, res) => {
  const q = normalizeTag(String(req.query.q ?? '')).replace(/\s+/g, '-').slice(0, 30);
  if (!q) return res.json({ tags: [] });
  const hidden = await getHiddenUserIds();
  const rows = await Post.aggregate([
    { $match: { tags: { $regex: escapeRegex(q) }, author: { $nin: hidden } } },
    { $unwind: '$tags' },
    { $match: { tags: { $regex: escapeRegex(q) } } },
    { $group: { _id: '$tags', posts: { $sum: 1 } } },
    { $sort: { posts: -1, _id: 1 } },
    { $limit: 10 },
  ]);
  res.json({ tags: rows.map((r) => ({ tag: r._id, posts: r.posts })) });
});

// ---------- Case of the Day ----------
/**
 * GET /posts/case-of-the-day: the case an admin chose, or (until one is chosen, or if it was
 * deleted/hidden) the most-discussed case. Members only see the case; admins also get `pinnedId`
 * so their menu can offer "Remove as Case of the Day".
 */
/** Today's case (raw, author populated) and the admin's pinned setting. Also used by the daily phone alert. */
export async function findCaseOfTheDay() {
  const [hidden, setting] = await Promise.all([getHiddenUserIds(), SiteSetting.findOne({ key: 'caseOfTheDay' }).lean()]);
  const usable = { type: 'case_study', author: { $nin: hidden }, 'privacyReview.removeAt': { $exists: false }, hiddenByReports: { $ne: true } };
  let post = setting?.post ? await populateAuthor(Post.findOne({ ...usable, _id: setting.post })).lean() : null;
  if (!post) post = await populateAuthor(Post.findOne(usable).sort({ commentCount: -1, createdAt: -1 })).lean();
  return { post, setting };
}

export const getCaseOfTheDay = asyncHandler(async (req, res) => {
  const { post, setting } = await findCaseOfTheDay();
  res.json({
    post: post ? serializePost(post, req.user) : null,
    ...(req.user?.isAdmin ? { pinnedId: setting?.post ? String(setting.post) : null } : {}),
  });
});

/** PUT /posts/case-of-the-day { postId } (admins): choose today's case; postId null goes back to automatic. */
export const setCaseOfTheDay = asyncHandler(async (req, res) => {
  const { postId } = req.body ?? {};
  if (postId !== null) {
    if (!mongoose.isValidObjectId(postId)) throw ApiError.badRequest('Invalid case');
    const ok = await Post.exists({ _id: postId, type: 'case_study' });
    if (!ok) throw ApiError.badRequest('Only a case can be the Case of the Day');
  }
  await SiteSetting.updateOne({ key: 'caseOfTheDay' }, { $set: { post: postId, updatedBy: req.user._id } }, { upsert: true });
  res.json({ pinnedId: postId, message: postId ? 'This case is now the Case of the Day' : 'Case of the Day is back to automatic' });
});

// ---------- read / update / delete ----------
export const getPost = asyncHandler(async (req, res) => {
  const viewerId = req.user?._id;
  // Deactivated accounts, and (for this viewer) blocked / blocking accounts.
  const [hidden, blocked] = await Promise.all([getHiddenUserIds(), hiddenAuthorsFor(req.user, { includeMuted: false })]);
  // The post and its comments are fetched together (each is a database round trip).
  const [post, comments] = await Promise.all([
    populateAuthor(Post.findById(req.params.id)).lean(),
    Comment.find({
      post: req.params.id,
      author: { $nin: [...hidden, ...blocked] },
      // flagged or report-hidden comments: only their author sees them
      ...visibleTo(viewerId),
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('author', AUTHOR_FIELDS)
      .lean(),
  ]);
  const isHidden = (id) => hidden.some((h) => h.equals(id));
  if (!post || (post.author && isHidden(post.author._id))) throw ApiError.notFound('Post not found');
  const mine = (authorId) => viewerId && String(authorId) === String(viewerId);
  // Flagged for patient privacy: only the author (who is asked to fix it) and admins can open it.
  if (post.privacyReview?.removeAt && !mine(post.author?._id) && !req.user?.isAdmin) {
    throw ApiError.notFound('This post is hidden while its author removes details that could identify a patient');
  }
  if (post.hiddenByReports && !mine(post.author?._id) && !req.user?.isAdmin) {
    throw ApiError.notFound('This post is hidden while a moderator reviews reports about it');
  }
  // Someone this viewer blocked (or who blocked them): treat as not there.
  if (post.author && blocked.some((b) => String(b) === String(post.author._id))) throw ApiError.notFound('Post not found');
  // Reading never changes counts: views are reported by the browser (POST /posts/views).
  res.json({
    post: { ...serializePost(post, req.user), canReply: await canReplyTo(post, req.user) },
    comments: comments.map((c) => serializeComment(c, req.user?._id)),
  });
});

/** POST /posts/views { posts: [ids], comments: [ids] } - cards the browser saw (≥50% visible for ≥1s). */
export const recordViewsBatch = asyncHandler(async (req, res) => {
  const ids = (v) => (Array.isArray(v) ? v.filter((id) => mongoose.isValidObjectId(id)) : []);
  const [posts, comments] = await Promise.all([
    recordViews('post', ids(req.body?.posts), req.user._id),
    recordViews('comment', ids(req.body?.comments), req.user._id),
  ]);
  res.json({ counted: { posts, comments } });
});

/** POST /posts/:id/view - the same for a single post. */
export const recordPostView = asyncHandler(async (req, res) => {
  const counted = await recordViews('post', [req.params.id], req.user._id);
  res.json({ counted: counted.length > 0 });
});

export const updatePost = asyncHandler(async (req, res) => {
  const post = await loadPost(req.params.id);
  assertOwner(post, req.user);

  const { title, content, caseStudy, tags, isSensitiveContent, replyPolicy, collab } = req.body;
  if (replyPolicy !== undefined) post.replyPolicy = replyPolicy;
  if (collab !== undefined) post.collab = collab;
  let newMentions = [];
  if (title !== undefined) {
    if (post.type === 'notes' && title.trim().length < 3) {
      throw ApiError.badRequest('Notes need a title (at least 3 characters)');
    }
    assertNoObviousPHI(title);
    post.title = title;
  }
  if (content !== undefined) {
    if (post.type === 'text') assertWordLimit(content, req.user);
    else if (content.length > 5000) throw ApiError.badRequest('Description can be at most 5000 characters');
    assertNoObviousPHI(content);
    const mentions = await resolveMentions(content);
    post.content = mentions.text;
    newMentions = mentions.mentionedIds;
    post.mentions = mentions.mentionedIds;
  }
  if (tags !== undefined) post.tags = tags;
  if (isSensitiveContent !== undefined) post.isSensitiveContent = isSensitiveContent;
  if (caseStudy !== undefined) {
    if (post.type !== 'case_study') throw ApiError.badRequest('Only case studies have case details');
    assertNoObviousPHI(caseStudy);
    // No options sent = keep the existing poll. Sent ones replace it ([] removes it), but once people
    // have voted the number of choices is fixed: votes point at a choice by its position.
    const keepPoll = caseStudy.pollOptions === undefined
      ? { pollOptions: post.caseStudy?.pollOptions, correctOption: post.caseStudy?.correctOption }
      : {};
    const votes = post.pollVotes?.length ?? 0;
    const before = post.caseStudy?.pollOptions?.length ?? 0;
    if (caseStudy.pollOptions !== undefined && votes > 0 && caseStudy.pollOptions.length !== before) {
      throw ApiError.badRequest(`${votes} ${votes === 1 ? 'person has' : 'people have'} already voted on this poll, so its ${before} choices can be reworded but not added or removed`);
    }
    if (caseStudy.pollOptions?.length === 0) caseStudy.correctOption = undefined;
    post.caseStudy = { ...caseStudy, ...keepPoll };
  }

  await post.save();
  // A post flagged by the privacy sweep is un-flagged once the edit took the identifying details out.
  if (post.privacyReview?.removeAt) {
    await reviewPrivacy(Post, post);
    post.privacyReview = (await Post.findById(post._id).select('privacyReview').lean())?.privacyReview;
  }
  await notifyMentions(newMentions, { sourceUser: req.user._id, post: post._id }); // repeat mentions are de-duplicated
  await populateAuthor(post);
  res.json({ post: serializePost(post, req.user) });
});

/** Deletes a post with its comments, notifications and notebook notes (also used by the privacy sweep). */
export async function removePost(post) {
  await Promise.all([
    Comment.deleteMany({ post: post._id }),
    Notification.deleteMany({ post: post._id }),
    NotebookNote.deleteMany({ post: post._id }),
    post.quoteOf && Post.updateOne({ _id: post.quoteOf, quoteCount: { $gt: 0 } }, { $inc: { quoteCount: -1 } }),
    post.quoteOfComment && Comment.updateOne({ _id: post.quoteOfComment, quoteCount: { $gt: 0 } }, { $inc: { quoteCount: -1 } }),
    post.deleteOne(),
  ]);
}

export const deletePost = asyncHandler(async (req, res) => {
  const post = await loadPost(req.params.id);
  if (String(post.author) !== String(req.user._id) && !req.user.isAdmin) {
    throw ApiError.forbidden('You can only delete your own posts');
  }
  await removePost(post);
  res.json({ message: 'Post deleted', id: post._id });
});

// ---------- toggles ----------
const toggle = (field, notifyType) =>
  asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const existing = await Post.findById(req.params.id).select(`author type ${field}`);
    if (!existing) throw ApiError.notFound('Post not found');

    const active = existing[field].some((id) => String(id) === String(userId));
    const update = active ? { $pull: { [field]: userId } } : { $addToSet: { [field]: userId } };
    const post = await populateAuthor(Post.findByIdAndUpdate(existing._id, update, { returnDocument: 'after' }));

    const type = typeof notifyType === 'function' ? notifyType(existing) : notifyType;
    if (type) {
      const payload = { recipient: existing.author, type, sourceUser: userId, post: existing._id };
      if (active) await removeNotification(payload);
      else await createNotification(payload);
    }

    res.json({ post: serializePost(post, req.user), active: !active });
  });

export const toggleLike = toggle('likes', 'like');
export const toggleRepost = toggle('reposts', 'repost');
// Saving someone's notes notifies the author; bookmarking other posts is private.
export const toggleBookmark = toggle('bookmarks', (post) => (post.type === 'notes' ? 'notes_saved' : null));

/** Vote on a case's "What's your diagnosis?" poll. One vote per member (they can remove it and vote again). */
export const votePoll = asyncHandler(async (req, res) => {
  const option = Number(req.body?.option);
  const post = await Post.findById(req.params.id).select('author type caseStudy.pollOptions pollVotes solvedBy');
  if (!post) throw ApiError.notFound('Post not found');
  const options = post.caseStudy?.pollOptions ?? [];
  if (post.type !== 'case_study' || !options.length) throw ApiError.badRequest('This case has no poll');
  if (!Number.isInteger(option) || option < 0 || option >= options.length) throw ApiError.badRequest('Pick one of the options');
  // Votes are final: one per member per case, never changed or removed. The update only applies
  // if this member has no vote in the case yet, in one atomic step, so two requests at the same
  // moment can't both count. (Votes live inside the case document, so this condition is what
  // keeps (case, member) unique - a database unique index can't police entries of one array.)
  const alreadySolved = (post.solvedBy ?? []).some((id) => String(id) === String(req.user._id));
  const { modifiedCount } = await Post.updateOne(
    { _id: post._id, 'pollVotes.user': { $ne: req.user._id } },
    { $push: { pollVotes: { user: req.user._id, option } }, $addToSet: { solvedBy: req.user._id } }
  );
  if (!modifiedCount) throw ApiError.conflict('You have already voted on this case. Votes are final.');
  if (!alreadySolved) await logActivity(req.user._id, 'solve', { post: post._id });
  const fresh = await Post.findById(post._id).select('author type caseStudy pollVotes solvedBy');
  // Voting unlocks the answer, so it comes back with the results.
  res.json({ poll: serializePost(fresh, req.user._id).poll, answers: caseAnswers(fresh.caseStudy) });
});

/**
 * POST /posts/:id/reveal - the member chose to see a case's answer. Records the reveal (the case now
 * counts as worked through, "solved", in Case Rounds) and returns the answer fields.
 * (POST /posts/:id/solve is the old name, kept for browsers still running the previous version.)
 */
export const revealAnswer = asyncHandler(async (req, res) => {
  const post = await Post.findOneAndUpdate(
    { _id: req.params.id, type: 'case_study' },
    { $addToSet: { solvedBy: req.user._id } },
    { returnDocument: 'before', projection: 'caseStudy solvedBy pollVotes' }
  );
  if (!post) throw ApiError.notFound('Case not found');
  const had = (list) => (list ?? []).some((x) => String(x.user ?? x) === String(req.user._id));
  // Counts once per case, and not again if they already voted on its poll.
  if (!had(post.solvedBy) && !had(post.pollVotes)) await logActivity(req.user._id, 'solve', { post: post._id });
  res.json({ solved: true, answers: caseAnswers(post.caseStudy) });
});

/** "Not interested in this post": hide it from my feeds. DELETE undoes it. */
export const markNotInterested = asyncHandler(async (req, res) => {
  if (!(await Post.exists({ _id: req.params.id }))) throw ApiError.notFound('Post not found');
  await User.updateOne({ _id: req.user._id }, { $pull: { notInterested: req.params.id } });
  await User.updateOne({ _id: req.user._id }, { $push: { notInterested: { $each: [req.params.id], $slice: -500 } } });
  res.json({ notInterested: true });
});

export const undoNotInterested = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { notInterested: req.params.id } });
  res.json({ notInterested: false });
});

/** Save (or with empty text, delete) the member's private Notebook note on a post. */
export const saveNotebookNote = asyncHandler(async (req, res) => {
  const exists = await Post.exists({ _id: req.params.id });
  if (!exists) throw ApiError.notFound('Post not found');
  const { text } = req.body;
  if (!text) {
    await NotebookNote.deleteOne({ user: req.user._id, post: req.params.id });
    return res.json({ note: '' });
  }
  const note = await NotebookNote.findOneAndUpdate(
    { user: req.user._id, post: req.params.id },
    { text },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  res.json({ note: note.text });
});

/** A member opened or downloaded a notes file. Each member is counted once per notes. */
export const recordDownload = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Post.updateOne(
    { _id: id, type: 'notes', downloaders: { $ne: req.user._id } },
    { $addToSet: { downloaders: req.user._id }, $inc: { downloadCount: 1 } }
  );
  const post = await Post.findById(id).select('downloadCount');
  if (!post) throw ApiError.notFound('Post not found');
  res.json({ downloadCount: post.downloadCount });
});

// ---------- moderation ----------
/** POST /posts/:id/report { reason, details? } - into the moderators' queue; hidden after enough reports. */
export const reportPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id).select('author reports hiddenByReports');
  if (!post) throw ApiError.notFound('Post not found');
  if (String(post.author) === String(req.user._id)) throw ApiError.badRequest("You can't report your own post");
  const { already } = await addReport(Post, post, req.user._id, normalizeReport(req.body), { kind: 'post' });
  res.json({ message: already ? 'You have already reported this post' : 'Thanks - our moderators will review this post' });
});
