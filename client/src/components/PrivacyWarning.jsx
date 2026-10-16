import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { findPrivacyIssues, privacyMessage, removePrivacyIssue } from '../lib/privacy';
import { cn } from '../lib/format';

/** True when any of the texts could identify a patient or asks for a patient's identity. */
export const hasPrivacyIssues = (texts) => texts.some((t) => findPrivacyIssues(t).length > 0);

/** "5 h 20 min" until `date` ("less than a minute" once it's due). */
function timeLeft(date) {
  const mins = Math.max(0, Math.round((new Date(date) - Date.now()) / 60000));
  if (mins < 1) return 'less than a minute';
  const h = Math.floor(mins / 60);
  return h ? `${h} h ${mins % 60} min` : `${mins} min`;
}

/**
 * Shown to the author on a published post or comment that Tectum's privacy check flagged
 * (`review` = { issues, removeAt }). Nobody else can see the content until it's fixed; if it isn't
 * fixed by removeAt, Tectum deletes it. `action` is the fix button (Edit now / Delete).
 */
export function PrivacyReviewBanner({ review, kind = 'post', action, className }) {
  if (!review?.removeAt) return null;
  return (
    <div
      role="alert"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'rounded-[12px] border border-warning/40 bg-warning-soft px-4 py-3 text-warning',
        className
      )}
    >
      <p className="flex items-start gap-2 font-semibold text-warning">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        Your {kind} may reveal a patient's identity
      </p>
      <p className="mt-1.5 text-[13px] leading-5">
        Tectum found {review.issues?.map((t, i) => (
          <span key={t}>{i > 0 && ', '}<b>"{t}"</b></span>
        ))}. This is not allowed: posts and comments must never show who a patient is or where they are.
      </p>
      <p className="mt-1.5 text-[13px] leading-5">
        It is hidden from everyone except you. {kind === 'post' ? 'Edit these details out' : 'Delete it'} within{' '}
        <b>{timeLeft(review.removeAt)}</b>, or Tectum will remove it automatically.
      </p>
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

/**
 * Warning bar under a post or comment box: lists each possible patient identifier (or request for one)
 * with a Remove button. `fields` = [{ text, onChange }] - every box the warning covers.
 * While it shows, the Post / Reply button should stay disabled (use hasPrivacyIssues).
 */
export default function PrivacyWarning({ fields, className }) {
  const found = fields.flatMap((f) => findPrivacyIssues(f.text).map((issue) => ({ issue, field: f })));
  if (!found.length) return null;
  const asking = found.some(({ issue }) => issue.kind === 'request');
  const title = asking
    ? 'Asking for a patient\'s identity is not allowed'
    : `Privacy check found ${found.length} possible identifier${found.length > 1 ? 's' : ''}`;

  return (
    <div
      role="alert"
      className={cn(
        'rounded-[12px] border border-warning/40 bg-warning-soft px-4 py-3 text-warning',
        className
      )}
    >
      <p className="flex items-start gap-2 font-semibold text-warning">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {found.map(({ issue, field }) => (
          <li key={`${issue.start}-${issue.text}`} className="flex items-start gap-3">
            <p className="min-w-0 flex-1 text-[13px] leading-5">{privacyMessage(issue)}</p>
            <button
              type="button"
              onClick={() => field.onChange(removePrivacyIssue(field.text, issue))}
              className="shrink-0 rounded-full bg-warning px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-warning"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] opacity-80">
        Posts and comments on Tectum must never reveal who a patient is or where they are. You can't post until this is fixed.
      </p>
    </div>
  );
}
