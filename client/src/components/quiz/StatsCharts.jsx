import { cn } from '../../lib/format';

/**
 * Small hand-drawn charts for test results (no chart library, like the study streak charts).
 * Each has a text alternative: an aria-label summary and a hidden table for screen readers.
 */

/** Correct / incorrect / unattempted as a donut. */
export function OutcomeDonut({ correct, wrong, unattempted, size = 150 }) {
  const total = correct + wrong + unattempted || 1;
  const parts = [
    { label: 'Correct', value: correct, color: 'var(--ds-success)' },
    { label: 'Incorrect', value: wrong, color: 'var(--ds-danger)' },
    { label: 'Unattempted', value: unattempted, color: 'var(--ds-line-strong)' },
  ];
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <figure className="flex flex-wrap items-center gap-5" aria-label={`Correct ${correct}, incorrect ${wrong}, unattempted ${unattempted}`}>
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-hidden="true">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--ds-surface-2)" strokeWidth="18" />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = (
            <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="fill-[var(--ds-fg)] font-semibold" fontSize="22">
          {Math.round((correct / total) * 100)}%
        </text>
        <text x="70" y="86" textAnchor="middle" className="fill-[var(--ds-fg-3)]" fontSize="11">
          correct
        </text>
      </svg>
      <ul className="space-y-1.5 text-[14px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: p.color }} aria-hidden="true" />
            <span className="text-ds-fg-2">{p.label}</span>
            <span className="ds-num ml-auto pl-4 font-semibold text-ink">{p.value}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Vertical bars, e.g. seconds per question or how many scored in each band. */
export function Bars({ items, valueLabel = (v) => v, height = 140, color = 'var(--ds-brand)', highlight, title }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure aria-label={title}>
      {/* extra room above the tallest bar for its value label */}
      <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: height + 44 }}>
        {items.map((it, i) => (
          <div key={i} className="flex min-w-[18px] flex-1 flex-col items-center justify-end" title={`${it.label}: ${valueLabel(it.value)}`}>
            <span className="ds-num mb-0.5 text-[10px] text-ds-fg-3">{it.value ? valueLabel(it.value) : ''}</span>
            <div className="w-full rounded-t-[4px]" style={{ height: Math.max(it.value ? 3 : 1, (it.value / max) * height), background: highlight?.(it, i) ? 'var(--ds-accent)' : it.value ? color : 'var(--ds-line)' }} />
            <span className="ds-num mt-1 text-[10px] text-ds-fg-3">{it.short ?? it.label}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <th>{it.label}</th>
              <td>{valueLabel(it.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal comparison bars: you vs class average vs highest. */
export function CompareBars({ rows, max }) {
  const top = Math.max(max || 0, ...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between text-[13px]">
            <span className="text-ds-fg-2">{r.label}</span>
            <span className="ds-num font-semibold text-ink">{r.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className={cn('h-full rounded-full', r.accent ? 'bg-ds-brand' : 'bg-ds-line-strong')} style={{ width: `${Math.max(0, (r.value / top) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Per-question accuracy, hardest first (organizer). */
export function AccuracyList({ items }) {
  const sorted = [...items].sort((a, b) => a.accuracy - b.accuracy);
  return (
    <ul className="space-y-2.5">
      {sorted.map((q) => (
        <li key={q.questionId}>
          <div className="mb-1 flex items-baseline gap-2 text-[13px]">
            <span className="ds-num shrink-0 font-semibold text-ds-fg-2">Q{q.number}</span>
            <span className="min-w-0 flex-1 truncate text-ds-fg-2" title={q.text}>{q.text}</span>
            <span className={cn('ds-num shrink-0 font-semibold', q.accuracy < 40 ? 'text-danger' : q.accuracy >= 75 ? 'text-success' : 'text-ink')}>{q.accuracy}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={cn('h-full rounded-full', q.accuracy < 40 ? 'bg-danger' : q.accuracy >= 75 ? 'bg-success' : 'bg-ds-brand')} style={{ width: `${q.accuracy}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
