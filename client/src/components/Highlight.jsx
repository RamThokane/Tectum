import { useRef } from 'react';
import { Highlighter } from 'lucide-react';
import { toast } from '../store/ui';

/**
 * Key findings in a case (History / Examination / Labs): the poster selects words and taps
 * "Highlight"; they're stored as ==words== and readers see them underlined in red.
 */
const MARK = /==([^=\n](?:[^\n]*?[^=\n])?)==/g;

/** Text with ==marks== shown as red-underlined key findings. */
export function HighlightedText({ text }) {
  if (!text) return null;
  const parts = text.split(MARK);
  // split with one capture group: odd indexes are the highlighted bits
  return parts.map((p, i) =>
    i % 2 ? (
      <mark key={i} className="bg-transparent font-medium text-inherit underline decoration-danger decoration-2 underline-offset-[3px]">
        {p}
      </mark>
    ) : (
      p
    )
  );
}

/** The same text without the == marks (previews, summaries). */
export const stripHighlights = (text = '') => text.replace(MARK, '$1');

/** Wrap the selection in ==…==, or take the marks off if it's already highlighted. */
function toggleMark(value, start, end) {
  // leave spaces at the edges of the selection outside the mark
  while (start < end && /\s/.test(value[start])) start++;
  while (end > start && /\s/.test(value[end - 1])) end--;
  if (start === end) return null;
  const before = value.slice(0, start);
  const sel = value.slice(start, end);
  const after = value.slice(end);
  if (before.endsWith('==') && after.startsWith('==')) {
    return { value: before.slice(0, -2) + sel + after.slice(2), start: start - 2, end: end - 2 };
  }
  if (sel.length > 4 && sel.startsWith('==') && sel.endsWith('==')) {
    const inner = sel.slice(2, -2);
    return { value: before + inner + after, start, end: start + inner.length };
  }
  const clean = sel.replace(/==/g, '');
  return { value: `${before}==${clean}==${after}`, start: start + 2, end: start + 2 + clean.length };
}

/**
 * A case textarea with a "Highlight" button above it. Shows a preview of how readers will see
 * the highlights once there are any.
 */
export function HighlightTextarea({ value, onChange, id, className = 'input', ...props }) {
  const ref = useRef(null);
  const highlight = () => {
    const el = ref.current;
    if (!el) return;
    const next = toggleMark(value ?? '', el.selectionStart, el.selectionEnd);
    if (!next) {
      toast('Select the words you want to highlight first, then tap Highlight.');
      el.focus();
      return;
    }
    onChange(next.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  };
  const hasMarks = stripHighlights(value ?? '') !== (value ?? '');

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="muted text-[12px]">Select key findings, then tap Highlight to underline them in red.</span>
        <button
          type="button"
          // keep the textarea's selection: don't take focus on press
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={highlight}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-danger/40 px-2.5 py-1 text-[12px] font-medium text-danger transition hover:bg-danger-soft"
          aria-controls={id}
          title="Underline the selected words in red (tap again to remove)"
        >
          <Highlighter className="h-3.5 w-3.5" strokeWidth={1.75} /> Highlight
        </button>
      </div>
      <textarea ref={ref} id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
      {hasMarks && (
        <p className="mt-1.5 whitespace-pre-wrap break-words rounded-[8px] bg-surface-2 px-3 py-2 text-[13px] leading-5 text-ink">
          <span className="ds-eyebrow mr-1.5">Preview</span>
          <HighlightedText text={value} />
        </p>
      )}
    </div>
  );
}
