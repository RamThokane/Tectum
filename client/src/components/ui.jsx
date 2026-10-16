import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Loader2, X, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/format';
import { useUIStore } from '../store/ui';

/**
 * Freezes the page behind an open menu, sheet or dialog. `overflow: hidden` alone doesn't stop
 * phone browsers (the page still slides when you drag), so the body is pinned in place and the
 * scroll position restored afterwards. Nested locks are counted.
 */
let lockCount = 0;
let savedY = 0;
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const body = document.body;
    if (lockCount++ === 0) {
      savedY = window.scrollY;
      Object.assign(body.style, { position: 'fixed', top: `-${savedY}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' });
      document.documentElement.style.overscrollBehavior = 'none';
    }
    return () => {
      if (--lockCount === 0) {
        Object.assign(body.style, { position: '', top: '', left: '', right: '', width: '', overflow: '' });
        document.documentElement.style.overscrollBehavior = '';
        window.scrollTo(0, savedY);
      }
    };
  }, [active]);
}

/**
 * A sideways-scrolling row (chips, filters) that shows it scrolls: the edge fades where more is
 * hidden, and on computers small arrow buttons scroll it.
 */
export function ScrollRow({ children, className, label }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, []);
  const by = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' });
  const mask = `linear-gradient(to right, ${edges.left ? 'transparent, #000 2.5rem' : '#000'}, ${edges.right ? '#000 calc(100% - 2.5rem), transparent' : '#000'})`;
  const arrow = 'absolute top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ds-fg-2 hover:bg-surface-2 md:flex';
  return (
    <div className="relative" role={label ? 'group' : undefined} aria-label={label}>
      {edges.left && (
        <button type="button" className={cn(arrow, 'left-0')} onClick={() => by(-1)} aria-label="Scroll left">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div ref={ref} className={cn('no-scrollbar overflow-x-auto', className)} style={{ maskImage: mask, WebkitMaskImage: mask }}>
        {children}
      </div>
      {edges.right && (
        <button type="button" className={cn(arrow, 'right-0')} onClick={() => by(1)} aria-label="Scroll right">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Small inline spinner - only inside buttons and "loading more" rows, never as a whole page. */
export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={cn('animate-spin text-link', className)} aria-label="Loading" />;
}

/** A quiet shape with a soft shimmer while content loads. */
export function Skeleton({ className }) {
  return <div className={cn('ds-shimmer rounded-[6px]', className)} aria-hidden="true" />;
}

/** Card-shaped placeholders: keeps the page's layout and background while data loads (no lone spinner). */
export function CardSkeleton({ lines = 3, avatar = true, className }) {
  return (
    <div className={cn('card p-4', className)} aria-hidden="true">
      <div className="flex items-center gap-3">
        {avatar && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}

/** Whole-page loading state: a few card skeletons in the page's own layout. */
export function PageLoader({ count = 3 }) {
  return (
    <div className="space-y-3 p-2 md:p-3" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Line icon + one sentence + one clear action. */
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line text-ds-fg-3">
          <Icon className="h-6 w-6" strokeWidth={1.5} />
        </span>
      )}
      <h3 className="font-editorial text-[20px] font-medium leading-[26px]">{title}</h3>
      {children && <p className="muted mt-1 max-w-sm text-[15px] leading-[23px]">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
      <p className="mt-2 text-[13px] text-danger">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <button className="btn-secondary mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Centered glass dialog on desktop, bottom sheet on mobile. Focus moves in; Escape closes. */
export function Modal({ open, onClose, title, children, footer, size = 'max-w-lg', hideHeader = false }) {
  const panel = useRef(null);
  // Kept in a ref: callers often pass a new arrow function each render, and re-running the effect
  // below on every keystroke would pull focus out of whatever box the person is typing in.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useScrollLock(open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    document.addEventListener('keydown', onKey);
    const lastFocus = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      lastFocus?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ds-scrim ds-fade absolute inset-0" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={cn(
          'ds-glass-strong ds-rise relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[20px] pb-[env(safe-area-inset-bottom)] outline-none sm:rounded-[20px] sm:pb-0',
          size
        )}
      >
        {/* grab handle on phones */}
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-ds-line-strong sm:hidden" aria-hidden="true" />
        {hideHeader ? (
          // content carries its own heading; just a close button in the corner
          <button className="btn-ghost absolute right-2 top-2 z-10 min-h-11 min-w-11 p-2" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        ) : (
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-editorial text-[20px] font-medium leading-[26px]">{title}</h2>
            <button className="btn-ghost -mr-2 min-h-11 min-w-11 p-2" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {/* min-h-0 lets this area shrink and scroll; without it the end of a long form was clipped under the footer */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'ds-glass-strong ds-slide-in pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium',
            t.tone === 'error' ? 'text-danger' : 'text-ink'
          )}
        >
          {t.tone === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

/** Hover / focus tooltip for icon buttons and badges. */
export function Tooltip({ label, children, side = 'top', className }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      aria-describedby={show ? id : undefined}
    >
      {children}
      {show && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'ds-glass-strong ds-fade pointer-events-none absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2 rounded-[6px] px-2.5 py-1.5 text-[12px] font-medium leading-4 text-ink',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}

/** Circular progress (0-1), e.g. today's goals. */
export function ProgressRing({ value, size = 40, stroke = 4, className, children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ds-surface-3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="var(--ds-brand-text)"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {children && <span className="ds-num absolute inset-0 flex items-center justify-center text-[12px] font-semibold">{children}</span>}
    </span>
  );
}

/** Small pill for tags and meta ("50s · Male", "Hard"). `tone` picks a semantic colour. */
const TONES = {
  neutral: 'border-line-strong text-ds-fg-2',
  brand: 'border-transparent bg-ds-brand-soft text-ds-brand-text',
  success: 'border-transparent bg-success-soft text-success',
  danger: 'border-transparent bg-danger-soft text-danger',
  warning: 'border-transparent bg-warning-soft text-warning',
  info: 'border-transparent bg-info-soft text-info',
};
export function Chip({ tone = 'neutral', icon: Icon, className, children, ...props }) {
  return (
    <span className={cn('chip', TONES[tone], className)} {...props}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Password box with an eye button to show / hide what's typed. */
export function PasswordInput({ className, ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className={cn('input pr-11', className)} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ds-fg-3 hover:text-ds-fg-2"
        aria-label={shown ? 'Hide password' : 'Show password'}
        title={shown ? 'Hide password' : 'Show password'}
      >
        {shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        {description && <span className="muted block text-[12px]">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-ds-brand' : 'bg-surface-3')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}
