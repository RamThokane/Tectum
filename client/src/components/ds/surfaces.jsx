import { cloneElement, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/format';
import { useScrollLock } from '../ui';
import { useDsTheme } from './theme';

/** Flat content card: surface + hairline, 12px corners. `interactive` adds the 1px hover lift. */
export function Card({ as: Tag = 'div', interactive = false, className, children, ...props }) {
  return (
    <Tag className={cn('ds-card', interactive && 'ds-lift cursor-pointer', className)} {...props}>
      {children}
    </Tag>
  );
}

/** Glass panel (20px corners): only for things that float over content. `strong` for menus / sheets. */
export function GlassPanel({ as: Tag = 'div', strong = false, className, children, ...props }) {
  return (
    <Tag className={cn(strong ? 'ds-glass-strong' : 'ds-glass', 'rounded-ds-lg', className)} {...props}>
      {children}
    </Tag>
  );
}

/** Closes something when you click outside `ref` or press Escape. */
function useDismiss(open, ref, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ref, onClose]);
}

/**
 * Dialog: a centred glass panel on wide screens, a bottom sheet on phones. Focus moves in,
 * Escape and the scrim close it, the page behind can't scroll.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'max-w-lg' }) {
  const theme = useDsTheme();
  const panel = useRef(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  const titleId = useId();
  useScrollLock(open);
  useEffect(() => {
    if (!open) return undefined;
    const last = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === 'Escape' && close.current?.();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      last?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className={cn(`ds-${theme}`, 'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6')} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="ds-scrim ds-fade absolute inset-0" onClick={() => close.current?.()} />
      <div
        ref={panel}
        tabIndex={-1}
        className={cn(
          'ds-glass-strong ds-rise relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-ds-lg pb-[env(safe-area-inset-bottom)] font-ui text-ds-fg outline-none sm:rounded-ds-lg sm:pb-0',
          size
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-ds-line-strong sm:hidden" aria-hidden="true" />
        <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
          <div>
            <h2 id={titleId} className="font-editorial text-title font-medium">{title}</h2>
            {description && <p className="mt-1 text-meta text-ds-fg-3">{description}</p>}
          </div>
          <button type="button" onClick={() => close.current?.()} className="ds-focus -mr-2 -mt-1 flex size-9 items-center justify-center rounded-full text-ds-fg-3 hover:bg-ds-surface-2 hover:text-ds-fg" aria-label="Close">
            <X className="size-4.5" strokeWidth={1.5} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-5">{children}</div>
        {footer && <footer className="flex shrink-0 justify-end gap-2 border-t border-ds-line px-6 py-3.5">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

/**
 * Menu from a button. `trigger` is a button element; `items`: [{ label, icon, onSelect, danger }]
 * or 'divider'. Arrow keys move, Enter picks, Escape closes.
 */
export function Dropdown({ trigger, items, align = 'end', label = 'Menu' }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef(null);
  const menuId = useId();
  const actionable = items.filter((i) => i !== 'divider');
  useDismiss(open, wrap, () => setOpen(false));
  useEffect(() => {
    if (open) wrap.current?.querySelectorAll('[role="menuitem"]')[active]?.focus();
  }, [open, active]);
  const onKey = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => (a + 1) % actionable.length));
    if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => (a - 1 + actionable.length) % actionable.length));
    if (e.key === 'Tab') setOpen(false);
  };
  // position of each actionable item (dividers don't count) for keyboard focus
  const indexOf = new Map(actionable.map((it, i) => [it, i]));
  return (
    <div ref={wrap} className="relative inline-block" onKeyDown={onKey}>
      {cloneElement(trigger, {
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: () => (setActive(0), setOpen((o) => !o)),
      })}
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={cn('ds-glass-strong ds-rise absolute z-40 mt-2 min-w-52 rounded-ds-lg p-1.5', align === 'end' ? 'right-0' : 'left-0')}>
          {items.map((it, i) => {
            if (it === 'divider') return <div key={`d${i}`} className="my-1.5 h-px bg-ds-line" role="separator" />;
            const idx = indexOf.get(it);
            return (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                tabIndex={idx === active ? 0 : -1}
                onMouseEnter={() => setActive(idx)}
                onClick={() => (setOpen(false), it.onSelect?.())}
                className={cn(
                  'flex h-9 w-full items-center gap-2.5 rounded-ds-sm px-2.5 text-left text-body outline-none',
                  it.danger ? 'text-ds-danger' : 'text-ds-fg',
                  idx === active && 'bg-ds-surface-2'
                )}
              >
                {it.icon && <it.icon className="size-4 text-current opacity-80" strokeWidth={1.5} aria-hidden="true" />}
                {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A small floating panel next to a button (non-modal): filters, quick info. */
export function Popover({ trigger, children, align = 'start', label }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const id = useId();
  useDismiss(open, wrap, () => setOpen(false));
  return (
    <div ref={wrap} className="relative inline-block">
      {cloneElement(trigger, { 'aria-expanded': open, 'aria-controls': open ? id : undefined, onClick: () => setOpen((o) => !o) })}
      {open && (
        <div id={id} role="dialog" aria-label={label} className={cn('ds-glass-strong ds-rise absolute z-40 mt-2 w-72 rounded-ds-lg p-4', align === 'end' ? 'right-0' : 'left-0')}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Tooltip on hover and keyboard focus. Wrap one focusable element. */
export function Tooltip({ content, children, side = 'top' }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {cloneElement(children, { 'aria-describedby': show ? id : undefined })}
      {show && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'ds-glass-strong ds-fade pointer-events-none absolute left-1/2 z-50 w-max max-w-60 -translate-x-1/2 rounded-ds-sm px-2.5 py-1.5 text-caption font-medium text-ds-fg',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

// ---- toasts: toast('Saved') / toast('Could not save', 'danger') from anywhere ----
let toasts = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
export function toast(message, tone = 'success') {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3800);
}
const TOAST_ICONS = { success: CheckCircle2, danger: AlertTriangle, info: Info };
const TOAST_TONES = { success: 'text-ds-success', danger: 'text-ds-danger', info: 'text-ds-info' };

/** One toast (also used on its own in the styleguide). */
export function Toast({ message, tone = 'success' }) {
  const Icon = TOAST_ICONS[tone] ?? Info;
  return (
    <div className="ds-glass-strong ds-slide-in flex items-center gap-2.5 rounded-full py-2.5 pl-3.5 pr-5 text-meta font-medium text-ds-fg" role="status">
      <Icon className={cn('size-4.5 shrink-0', TOAST_TONES[tone])} strokeWidth={1.75} aria-hidden="true" />
      {message}
    </div>
  );
}

/** Where toasts appear (bottom centre on phones, bottom right on wide screens). Mount once. */
export function ToastViewport() {
  const theme = useDsTheme();
  const list = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => toasts
  );
  return createPortal(
    <div className={cn(`ds-${theme}`, 'pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end')} aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast message={t.message} tone={t.tone} />
        </div>
      ))}
    </div>,
    document.body
  );
}

/** Profile preview on hover / focus of a name or avatar (after a short pause, so it never flickers). */
export function HoverCard({ card, children }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 350);
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {open && <span className="ds-glass-strong ds-rise absolute left-0 top-full z-40 mt-2 w-72 rounded-ds-lg p-4 text-left">{card}</span>}
    </span>
  );
}
