import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { findPrivacyIssues, PRIVACY_RULES_VERSION } from './privacy.js';
import { notifyFromTectum } from './notify.js';
import { removePost } from '../controllers/postController.js';
import { removeComment } from '../controllers/commentController.js';

/**
 * Patient-privacy check for content that is already published.
 * New posts and comments are refused up front (utils/phi.js), but older ones - and anything posted
 * before a rule was added - are checked here. When published text could identify a patient:
 *   1. it is flagged (privacyReview), hidden from everyone but its author, and the author is notified;
 *   2. the author sees a warning on it and has GRACE_HOURS to edit the details out;
 *   3. if it still has them after that, Tectum deletes it and tells the author.
 */
export const GRACE_HOURS = 24;
const EVERY_MS = 10 * 60 * 1000; // how often the sweep runs
const BATCH = 200;

const stringsIn = (v) =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(stringsIn) : v && typeof v === 'object' ? Object.values(v).flatMap(stringsIn) : [];

const isComment = (Model) => Model === Comment;

/** The identifying phrases in a post or comment ([] when it's fine). */
export function privacyIssuesOf(Model, doc) {
  const texts = isComment(Model) ? [doc.text] : [doc.title, doc.content, ...stringsIn(doc.caseStudy?.toObject?.() ?? doc.caseStudy ?? {})];
  return [...new Set(texts.filter(Boolean).flatMap((t) => findPrivacyIssues(t).map((i) => i.text)))];
}

const snippet = (doc) => String(doc.text || doc.title || doc.content || doc.caseStudy?.chiefComplaint || '').slice(0, 120);

/**
 * Checks one post or comment now and flags / clears it. `Model` is Post or Comment.
 * Returns the issues found. Call after an author edits their post so a fixed post is un-flagged.
 */
export async function reviewPrivacy(Model, doc) {
  const issues = privacyIssuesOf(Model, doc);
  const now = new Date();
  if (!issues.length) {
    await Model.updateOne({ _id: doc._id }, { $unset: { privacyReview: 1 }, $set: { privacyChecked: PRIVACY_RULES_VERSION } });
    return issues;
  }
  const alreadyFlagged = Boolean(doc.privacyReview?.removeAt);
  const review = alreadyFlagged
    ? { issues, flaggedAt: doc.privacyReview.flaggedAt, removeAt: doc.privacyReview.removeAt } // same deadline
    : { issues, flaggedAt: now, removeAt: new Date(now.getTime() + GRACE_HOURS * 3600 * 1000) };
  await Model.updateOne({ _id: doc._id }, { $set: { privacyReview: review, privacyChecked: PRIVACY_RULES_VERSION } });
  if (!alreadyFlagged) {
    const what = isComment(Model) ? 'Your comment' : 'Your post';
    await notifyFromTectum({
      recipient: doc.author,
      type: 'privacy_warning',
      post: isComment(Model) ? doc.post : doc._id,
      note: `${what} may identify a patient (${issues.map((i) => `"${i}"`).join(', ')}). Edit it out within ${GRACE_HOURS} hours or Tectum will remove it.`,
    });
  }
  return issues;
}

/** Deletes flagged content whose deadline has passed and that still identifies a patient. */
async function removeOverdue(Model) {
  const overdue = await Model.find({ 'privacyReview.removeAt': { $lte: new Date() } }).limit(BATCH);
  for (const doc of overdue) {
    if (!privacyIssuesOf(Model, doc).length) {
      await Model.updateOne({ _id: doc._id }, { $unset: { privacyReview: 1 } });
      continue;
    }
    const what = isComment(Model) ? 'comment' : 'post';
    if (isComment(Model)) await removeComment(doc);
    else await removePost(doc);
    await notifyFromTectum({
      recipient: doc.author,
      type: 'privacy_removed',
      post: isComment(Model) ? doc.post : null,
      note: `Tectum removed your ${what} "${snippet(doc)}" because it still identified a patient after ${GRACE_HOURS} hours.`,
    });
    console.log(`[privacy] removed ${what} ${doc._id}`);
  }
}

/** Checks everything not yet checked against the current rules. */
async function checkUnchecked(Model) {
  for (;;) {
    // $not also matches older documents that have no privacyChecked stored at all.
    const batch = await Model.find({ privacyChecked: { $not: { $gte: PRIVACY_RULES_VERSION } } }).limit(BATCH);
    if (!batch.length) return;
    for (const doc of batch) {
      const issues = await reviewPrivacy(Model, doc);
      if (issues.length) console.log(`[privacy] flagged ${isComment(Model) ? 'comment' : 'post'} ${doc._id}:`, issues.join(' | '));
    }
  }
}

export async function runPrivacySweep() {
  try {
    await checkUnchecked(Post);
    await checkUnchecked(Comment);
    await removeOverdue(Post);
    await removeOverdue(Comment);
  } catch (err) {
    console.error('[privacy] sweep failed', err.message);
  }
}

/** Runs the sweep now and then every 10 minutes. */
export function startPrivacySweep() {
  runPrivacySweep();
  setInterval(runPrivacySweep, EVERY_MS).unref();
}
