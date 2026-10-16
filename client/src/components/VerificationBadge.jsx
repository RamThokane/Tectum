import { BadgeCheck, Clock, ShieldCheck } from 'lucide-react';
import { roleLabel, userTitle } from '../lib/constants';
import { cn } from '../lib/format';
import { Tooltip } from './ui';

/** Blue tick = verified (free: approving a member's document gives them the blue tick). */
export const hasBlueTick = (user) => user?.verificationStatus === 'verified';

/** What the tick means for this member, shown in its tooltip. */
function tickMeaning(user) {
  const what =
    user.role === 'doctor'
      ? 'Verified doctor: medical council registration checked by the Tectum team.'
      : user.role === 'student'
        ? 'Verified student: college ID checked by the Tectum team.'
        : user.role === 'nurse'
          ? 'Verified nurse: nursing council registration or college ID checked by the Tectum team.'
          : 'Verified: professional or student ID checked by the Tectum team.';
  return what;
}

/** The blue tick, shown for verified members. Hover or keyboard-focus it for what was checked. */
export function Tick({ user, className = 'h-4 w-4' }) {
  if (!hasBlueTick(user)) return null;
  const meaning = tickMeaning(user);
  return (
    <Tooltip label={meaning} className="shrink-0">
      <span tabIndex={0} role="img" aria-label={meaning} className="inline-flex rounded-full">
        <BadgeCheck className={cn(className, 'fill-tick text-ds-surface')} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

/** Role labels are quiet (no pastel per role): doctors get the soft blue so they still stand out. */
const ROLE_PILLS = {
  doctor: 'bg-ds-brand-soft text-ds-brand-text',
  other: 'bg-ds-surface-2 text-ds-fg-2',
};

/**
 * "Student" / "Doctor" / "Nurse"… as a small coloured pill next to a name. Pass user and a
 * specialist's own designation (e.g. "Cardiologist") shows instead, in their role's colour.
 */
export function RolePill({ role: roleProp, user, className }) {
  const role = user?.role ?? roleProp;
  if (user?.isOfficial) {
    return (
      <span title="Official Tectum account" aria-label="Official Tectum account" className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-[6px] bg-ds-brand px-1.5 py-px text-[12px] font-medium leading-4 text-ds-on-brand', className)}>
        <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Official
      </span>
    );
  }
  if (!role) return null;
  const text = user ? userTitle(user) : roleLabel(role);
  // A specialist title ("Cardiologist") still says which role it is, for screen readers and on hover.
  const full = text === roleLabel(role) ? text : `${roleLabel(role)}: ${text}`;
  return (
    <span title={full} aria-label={full} className={cn('inline-flex shrink-0 items-center rounded-[6px] px-1.5 py-px text-[12px] font-medium leading-4', ROLE_PILLS[role] ?? ROLE_PILLS.other, className)}>
      {text}
    </span>
  );
}

/** Tick + role pill. `showPending` shows a clock while a verification document is under review. */
export default function VerificationBadge({ user, showRole = true, showPending = false, className }) {
  if (!user) return null;

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Tick user={user} />
      {showPending && user.verificationStatus === 'pending' && (
        <Clock className="h-3.5 w-3.5 text-warning" aria-label="Verification pending" />
      )}
      {showRole && <RolePill user={user} />}
    </span>
  );
}
