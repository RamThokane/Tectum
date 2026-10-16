import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { prettyTag } from '../lib/constants';
import { cn } from '../lib/format';

/**
 * Renders a tag as a link (default), a selectable chip (onToggle) or a removable chip (onRemove).
 */
export default function SpecialtyTagChip({ tag, selected, onToggle, onRemove, size = 'sm', asLink = true, className }) {
  const base = cn(
    'inline-flex items-center gap-1 rounded-full border font-medium transition capitalize',
    size === 'sm' ? 'px-2.5 py-0.5 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
    selected ? 'border-link bg-ds-brand-soft text-link' : 'border-line-strong text-ds-fg-2 hover:bg-surface-2 hover:text-ink',
    className
  );

  if (onToggle) {
    return (
      <button type="button" className={base} aria-pressed={!!selected} onClick={() => onToggle(tag)}>
        {prettyTag(tag)}
      </button>
    );
  }
  if (onRemove) {
    return (
      <span className={base}>
        {prettyTag(tag)}
        <button type="button" onClick={() => onRemove(tag)} aria-label={`Remove ${tag}`} className="-mr-1 rounded-full p-0.5 hover:bg-surface-2">
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  }
  if (!asLink) return <span className={base}>{prettyTag(tag)}</span>;
  return (
    <Link to={`/discover?q=${encodeURIComponent('#' + tag)}`} className={base}>
      #{prettyTag(tag)}
    </Link>
  );
}
