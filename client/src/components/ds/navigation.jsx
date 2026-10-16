import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/format';

/** Measures the active item so an indicator can slide to it (and re-measures on resize). */
function useIndicator(value, count) {
  const list = useRef(null);
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.querySelector('[aria-selected="true"], [aria-checked="true"]');
      if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (list.current) ro.observe(list.current);
    return () => ro.disconnect();
  }, [value, count]);
  return [list, box];
}

/** Arrow-key movement shared by tabs and segmented controls (roving focus, wraps around). */
const arrowKeys = (items, value, onChange) => (e) => {
  const i = items.findIndex((t) => t.value === value);
  const next = e.key === 'ArrowRight' ? (i + 1) % items.length : e.key === 'ArrowLeft' ? (i - 1 + items.length) % items.length : null;
  if (next === null) return;
  e.preventDefault();
  onChange(items[next].value);
  e.currentTarget.querySelectorAll('[role="tab"], [role="radio"]')[next]?.focus();
};

/**
 * Tabs with a blue indicator that slides between them. items: [{ value, label, icon?, count? }].
 * Put it in a sticky glass header for page-level tabs (profile, Ward, notifications).
 */
export function Tabs({ items, value, onChange, label, className }) {
  const [list, box] = useIndicator(value, items.length);
  return (
    <div ref={list} role="tablist" aria-label={label} onKeyDown={arrowKeys(items, value, onChange)} className={cn('relative flex overflow-x-auto [scrollbar-width:none]', className)}>
      {items.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn('ds-focus relative flex h-12 shrink-0 items-center gap-2 px-4 text-body font-medium transition-colors duration-150', on ? 'text-ds-fg' : 'text-ds-fg-3 hover:text-ds-fg')}
          >
            {t.icon && <t.icon className="size-4" strokeWidth={1.5} aria-hidden="true" />}
            {t.label}
            {t.count != null && <span className="ds-num text-meta text-ds-fg-3">{t.count}</span>}
          </button>
        );
      })}
      {box && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 h-0.5 rounded-full bg-ds-brand-text transition-[left,width] duration-200 ease-out"
          style={{ left: box.left + 12, width: Math.max(0, box.width - 24) }}
        />
      )}
    </div>
  );
}

/** Segmented control: 2-4 short options in a pill track; the selected one sits on a raised chip. */
export function SegmentedControl({ items, value, onChange, label, size = 'md' }) {
  const [list, box] = useIndicator(value, items.length);
  return (
    <div ref={list} role="radiogroup" aria-label={label} onKeyDown={arrowKeys(items, value, onChange)} className="relative inline-flex rounded-full bg-ds-surface-2 p-1">
      {box && (
        <span aria-hidden="true" className="absolute bottom-1 top-1 rounded-full bg-ds-surface shadow-ds-raised transition-[left,width] duration-200 ease-out" style={{ left: box.left, width: box.width }} />
      )}
      {items.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn('ds-focus relative z-[1] rounded-full font-medium transition-colors duration-150', size === 'sm' ? 'h-7 px-3 text-meta' : 'h-8 px-4 text-meta', on ? 'text-ds-fg' : 'text-ds-fg-3 hover:text-ds-fg')}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
