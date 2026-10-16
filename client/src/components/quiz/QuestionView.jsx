import { cn } from '../../lib/format';
import { assetUrl } from '../../api/client';
import { typeLabel } from '../../lib/quiz';

/**
 * A question as the participant answers it (also used for the organizer's preview).
 * Options are real radio buttons / checkboxes inside big labels, so arrow keys and Space work.
 */
export default function QuestionView({ question: q, number, total, selected = [], onChange, disabled, timeLeft }) {
  const multi = q.type === 'multiple';
  const pick = (id) => {
    if (disabled) return;
    if (multi) onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    else onChange([id]);
  };
  return (
    <section aria-labelledby={`q-${q._id}`} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="ds-eyebrow">
          Question {number}
          {total ? ` of ${total}` : ''}
        </span>
        <span className="chip border-line text-ds-fg-2">{typeLabel(q.type)}</span>
        <span className="chip border-line text-ds-fg-2">
          +{q.marks}
          {q.negativeMarks > 0 && <span className="text-danger"> / −{q.negativeMarks}</span>}
        </span>
        {timeLeft != null && <span className={cn('chip border-line', timeLeft <= 10 ? 'text-danger' : 'text-ds-fg-2')}>{timeLeft}s left for this question</span>}
      </div>
      <h2 id={`q-${q._id}`} className="whitespace-pre-wrap break-words text-[18px] leading-7 text-ink">{q.text}</h2>
      {q.image && <img src={assetUrl(q.image)} alt="" className="max-h-80 rounded-[12px] border border-line object-contain" draggable={false} />}

      {q.type === 'short' ? (
        <div className="max-w-md">
          <label className="label" htmlFor={`ans-${q._id}`}>Your answer</label>
          <input
            id={`ans-${q._id}`}
            className="input text-[17px]"
            value={selected[0] ?? ''}
            maxLength={200}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
            placeholder="Type your answer"
          />
        </div>
      ) : (
        <fieldset className="space-y-2.5" disabled={disabled}>
          <legend className="sr-only">{multi ? 'Choose all that apply' : 'Choose one answer'}</legend>
          {multi && <p className="muted text-[13px]">Choose all that apply.</p>}
          {q.options.map((o, i) => {
            const on = selected.includes(o._id);
            return (
              <label
                key={o._id}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-[12px] border px-4 py-3 transition-colors',
                  on ? 'border-ds-brand bg-ds-brand-soft' : 'border-line bg-surface hover:bg-surface-2',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <input type={multi ? 'checkbox' : 'radio'} name={`opt-${q._id}`} checked={on} onChange={() => pick(o._id)} className="h-5 w-5 shrink-0 accent-[var(--ds-brand)]" />
                <span className={cn('ds-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold', on ? 'border-ds-brand text-ds-brand-text' : 'border-line text-ds-fg-3')} aria-hidden="true">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="break-words text-[16px] leading-6 text-ink">{o.text}</span>
              </label>
            );
          })}
        </fieldset>
      )}
    </section>
  );
}
