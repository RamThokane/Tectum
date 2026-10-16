import { REPORT_REASONS } from '../models/Post.js';
import { notifyFromTectum } from './notify.js';

/**
 * Member reports on posts and comments.
 *  - Every report puts the item in the moderators' queue (Moderation > Reported).
 *  - Once HIDE_AFTER different members have reported it (HIDE_AFTER_PATIENT for "identifies a
 *    patient", which is more urgent), it is hidden from everyone except its author and admins, and
 *    the author is told. A moderator then keeps it (shown again, reports cleared) or removes it.
 */
export const HIDE_AFTER = Math.max(1, Number(process.env.REPORT_HIDE_THRESHOLD) || 3);
export const HIDE_AFTER_PATIENT = Math.max(1, Math.min(HIDE_AFTER, Number(process.env.REPORT_HIDE_THRESHOLD_PATIENT) || 2));

export const REPORT_LABELS = {
  'identifiable-patient': 'Identifies a patient',
  'wrong-information': 'Wrong or dangerous medical information',
  abuse: 'Harassment or abuse',
  spam: 'Spam or advertising',
  other: 'Something else',
};

/**
 * The app sends { reason: <one of REPORT_REASONS>, details }; the website sends { reason: "free text" }.
 * Both become { category, reason } (reason = the member's own words).
 */
export function normalizeReport(body = {}) {
  const r = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (REPORT_REASONS.includes(r)) return { category: r, reason: String(body.details ?? '').trim().slice(0, 500) };
  return { category: REPORT_REASONS.includes(body.category) ? body.category : 'other', reason: r.slice(0, 500) };
}

export const reportSummary = ({ category, reason }) => `${REPORT_LABELS[category] ?? 'Other'}${reason ? `: ${reason}` : ''}`;

/**
 * Adds one member's report to a post or comment document (loaded with reports/author/hiddenByReports).
 * Returns { already } if they had reported it, else { hidden } - whether it is hidden now.
 */
export async function addReport(Model, doc, userId, report, { kind = 'post', postId = null } = {}) {
  const reports = doc.reports ?? [];
  if (reports.some((r) => String(r.user) === String(userId))) return { already: true, hidden: !!doc.hiddenByReports };
  const entry = { user: userId, ...report, createdAt: new Date() };
  const all = [...reports, entry];
  const reporters = new Set(all.map((r) => String(r.user))).size;
  const patientReporters = new Set(all.filter((r) => r.category === 'identifiable-patient').map((r) => String(r.user))).size;
  const hide = !doc.hiddenByReports && (reporters >= HIDE_AFTER || patientReporters >= HIDE_AFTER_PATIENT);
  await Model.updateOne({ _id: doc._id }, { $push: { reports: entry }, $set: { reported: true, ...(hide ? { hiddenByReports: true } : {}) } });
  if (hide) {
    const what = kind === 'comment' ? 'Your reply' : 'Your post';
    await notifyFromTectum({
      recipient: doc.author,
      type: 'content_hidden',
      post: postId ?? (kind === 'post' ? doc._id : null),
      note: `${what} was reported by several members and is hidden while a moderator reviews it.`,
    });
  }
  return { already: false, hidden: hide || !!doc.hiddenByReports };
}

/**
 * Query filter: what a viewer may see - nothing hidden by reports or flagged for patient privacy,
 * except their own items (so authors can still see and fix them).
 */
export const visibleTo = (viewerId) => ({
  $and: [
    { $or: [{ 'privacyReview.removeAt': { $exists: false } }, ...(viewerId ? [{ author: viewerId }] : [])] },
    { $or: [{ hiddenByReports: { $ne: true } }, ...(viewerId ? [{ author: viewerId }] : [])] },
  ],
});
