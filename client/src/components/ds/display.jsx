import { AlertTriangle, RotateCcw } from 'lucide-react';
import { cn, initials } from '../../lib/format';
import { cldUrl } from '../../lib/cldUrl';
import { VerifiedShield } from './icons';
import { Button } from './Button';

// The Wards' 16 old hue names fold into the 8 specialty dot colours.
const HUE_TO_SPEC = {
  teal: 1, cyan: 1, emerald: 7, lime: 7, sky: 2, blue: 2, indigo: 3, violet: 3,
  purple: 4, fuchsia: 4, pink: 4, rose: 5, red: 5, orange: 6, amber: 6, slate: 8,
};
const SPEC_BG = {
  1: 'bg-ds-spec-1', 2: 'bg-ds-spec-2', 3: 'bg-ds-spec-3', 4: 'bg-ds-spec-4',
  5: 'bg-ds-spec-5', 6: 'bg-ds-spec-6', 7: 'bg-ds-spec-7', 8: 'bg-ds-spec-8',
};

/** The small specialty dot. `hue` is a Ward's hue name (specialtyMeta(slug).hue) or a number 1-8. */
export function SpecialtyDot({ hue = 'slate', className }) {
  const n = typeof hue === 'number' ? hue : HUE_TO_SPEC[hue] ?? 8;
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', SPEC_BG[n], className)} aria-hidden="true" />;
}

/** Tag / chip: outline pill, optional specialty dot, optional selected state (blue). */
export function Chip({ children, hue, selected = false, onClick, className }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-meta font-medium',
        onClick && 'ds-press ds-focus cursor-pointer',
        selected ? 'border-ds-brand-text bg-ds-brand-soft text-ds-brand-text' : 'border-ds-line-strong text-ds-fg-2 hover:border-ds-fg-4',
        className
      )}
    >
      {hue != null && <SpecialtyDot hue={hue} />}
      {children}
    </Tag>
  );
}

const ROLE_LABELS = { student: 'Student', resident: 'Resident', doctor: 'Doctor', nurse: 'Nurse', researcher: 'Researcher', other: 'Member', official: 'Official' };

/**
 * Role badge: quiet text label, a verified shield when checked by the team. Official accounts
 * get the blue treatment so they read as the platform speaking.
 */
export function RoleBadge({ role = 'student', label, verified = false, className }) {
  const official = role === 'official';
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-ds-sm px-1.5 text-caption font-medium',
        official ? 'bg-ds-brand text-ds-on-brand' : 'bg-ds-surface-2 text-ds-fg-2',
        className
      )}
    >
      {(verified || official) && <VerifiedShield size={12} className={official ? 'text-ds-on-brand' : 'text-ds-brand-text'} title={official ? 'Official Tectum account' : 'Verified by the Tectum team'} />}
      {label ?? ROLE_LABELS[role] ?? role}
    </span>
  );
}

/** Count / status badge: neutral, brand, accent (unread), success, warning, danger. */
export function Badge({ tone = 'neutral', children, className }) {
  const tones = {
    neutral: 'bg-ds-surface-2 text-ds-fg-2',
    brand: 'bg-ds-brand-soft text-ds-brand-text',
    accent: 'bg-ds-accent text-ds-on-accent',
    success: 'bg-ds-success-soft text-ds-success',
    warning: 'bg-ds-warning-soft text-ds-warning',
    danger: 'bg-ds-danger-soft text-ds-danger',
  };
  return <span className={cn('ds-num inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold', tones[tone], className)}>{children}</span>;
}

const AVATAR_PX = { xs: 24, sm: 32, md: 40, lg: 56, xl: 96 };
const AVATAR_TEXT = { xs: 'text-caption', sm: 'text-caption', md: 'text-meta', lg: 'text-title', xl: 'text-headline' };

/** Avatar: photo (sized by Cloudinary) or initials on a quiet fill; optional online dot. */
export function Avatar({ user, size = 'md', online = false, className }) {
  const px = AVATAR_PX[size] ?? 40;
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: px, height: px }}>
      {user?.profilePicture ? (
        <img src={cldUrl(user.profilePicture, { w: px, h: px })} alt="" width={px} height={px} loading="lazy" decoding="async" className="size-full rounded-full bg-ds-surface-2 object-cover" />
      ) : (
        <span className={cn('flex size-full items-center justify-center rounded-full bg-ds-surface-3 font-medium text-ds-fg-2', AVATAR_TEXT[size])} aria-hidden="true">
          {initials(user?.name)}
        </span>
      )}
      {online && <span className="absolute bottom-0 right-0 size-[28%] min-h-2 min-w-2 rounded-full border-2 border-ds-surface bg-ds-success" aria-label="Online" role="img" />}
    </span>
  );
}

/** Overlapping avatars ("+3" when there are more). */
export function AvatarGroup({ users, max = 4, size = 'sm', label }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="flex items-center" role="img" aria-label={label ?? `${users.length} people`}>
      {shown.map((u, i) => (
        <span key={u._id ?? i} className={cn('rounded-full ring-2 ring-ds-surface', i > 0 && '-ml-2')}>
          <Avatar user={u} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span className="-ml-2 flex size-8 items-center justify-center rounded-full bg-ds-surface-2 text-caption font-semibold text-ds-fg-2 ring-2 ring-ds-surface ds-num">+{extra}</span>
      )}
    </span>
  );
}

/**
 * Stats row: big tabular numbers with small uppercase labels, divided by hairlines (no boxes).
 * items: [{ label, value, hint? }]
 */
export function StatRow({ items, className }) {
  return (
    <dl className={cn('grid divide-ds-line max-sm:grid-cols-2 max-sm:gap-y-4 sm:flex sm:divide-x', className)}>
      {items.map((s) => (
        <div key={s.label} className="flex flex-col-reverse gap-1 sm:flex-1 sm:px-5 sm:first:pl-0 sm:last:pr-0">
          <dt className="ds-eyebrow">{s.label}</dt>
          <dd className="ds-num font-ui text-headline font-medium text-ds-fg">
            {s.value}
            {s.hint && <span className="ml-1.5 align-middle text-meta font-normal text-ds-fg-3">{s.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Progress bar (0-100). `tone` 'brand' | 'accent'. */
export function Progress({ value, tone = 'brand', label, className }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-ds-surface-2', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tone === 'accent' ? 'bg-ds-accent' : 'bg-ds-brand')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Grey shape that shimmers while content loads (never a spinner for content). */
export function Skeleton({ className }) {
  return <span className={cn('ds-shimmer block rounded-ds-sm', className)} aria-hidden="true" />;
}

/** Placeholder for a loading post card. */
export function CardSkeleton() {
  return (
    <div className="ds-card space-y-3 p-5" role="status" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      </div>
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

/** Nothing here yet: a line icon, one sentence, one action. */
export function EmptyState({ icon: Icon, title, children, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && <Icon className="size-7 text-ds-fg-4" strokeWidth={1.25} aria-hidden="true" />}
      <p className="mt-4 font-editorial text-title text-ds-fg">{title}</p>
      {children && <p className="mt-1.5 max-w-sm text-body text-ds-fg-3">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Something failed: what happened and a retry. */
export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center" role="alert">
      <AlertTriangle className="size-6 text-ds-danger" strokeWidth={1.5} aria-hidden="true" />
      <p className="mt-3 text-body text-ds-fg">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" icon={RotateCcw} className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
