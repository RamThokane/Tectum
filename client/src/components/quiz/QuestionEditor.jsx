import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, ImagePlus, Link2, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/format';
import { QUESTION_TYPES, newId, plural } from '../../lib/quiz';
import { uploadQuestionImage } from '../../hooks/useQuiz';
import { assetUrl } from '../../api/client';
import { toast } from '../../store/ui';

export const MAX_OPTIONS = 6;

/** A blank question of a type (true/false comes with its two options). */
export function blankQuestion(type = 'single') {
  const base = { _id: newId(), type, text: '', image: '', options: [], correctAnswers: [], numericTolerance: 0, marks: 1, negativeMarks: 0, explanation: '', timeLimitSec: 0 };
  if (type === 'truefalse') base.options = [{ _id: newId(), text: 'True' }, { _id: newId(), text: 'False' }];
  if (type === 'single' || type === 'multiple') base.options = [{ _id: newId(), text: '' }, { _id: newId(), text: '' }, { _id: newId(), text: '' }, { _id: newId(), text: '' }];
  return base;
}

/** Switching type keeps what still makes sense (the text, marks, and options for single <-> multiple). */
function convert(q, type) {
  if (type === q.type) return q;
  if (type === 'truefalse') {
    const fresh = blankQuestion('truefalse');
    return { ...q, type, options: fresh.options, correctAnswers: [], numericTolerance: 0 };
  }
  if (type === 'short') return { ...q, type, options: [], correctAnswers: [], numericTolerance: 0 };
  const options = q.type === 'single' || q.type === 'multiple' ? q.options : blankQuestion(type).options;
  const ids = new Set(options.map((o) => o._id));
  let correct = q.correctAnswers.filter((c) => ids.has(c));
  if (type === 'single') correct = correct.slice(0, 1);
  return { ...q, type, options, correctAnswers: correct };
}

/**
 * Pasted text -> one option per line (or per cell of a copied spreadsheet row), without blank
 * lines or labels like "A.", "(b)", "3)" in front.
 */
export function splitPastedOptions(raw) {
  const lines = String(raw).split(/\r?\n/).length > 1 ? String(raw).split(/\r?\n/) : String(raw).split('\t');
  return lines
    // (a space must follow the label, so "1.5 mg" stays as it is)
    .map((l) => l.replace(/^\s*(?:option\s*)?\(?[a-f1-6][.):\]]\s+/i, '').trim().slice(0, 500))
    .filter(Boolean);
}

/** The options of a single / multiple / true-false question, each with its "correct" control. */
export function OptionEditor({ question: q, onChange, locked }) {
  const multi = q.type === 'multiple';
  const fixed = q.type === 'truefalse';
  const toggle = (id) => {
    if (multi) onChange({ ...q, correctAnswers: q.correctAnswers.includes(id) ? q.correctAnswers.filter((c) => c !== id) : [...q.correctAnswers, id] });
    else onChange({ ...q, correctAnswers: [id] });
  };
  const setText = (id, text) => onChange({ ...q, options: q.options.map((o) => (o._id === id ? { ...o, text } : o)) });
  // Like Google Forms: pasting several lines (or a spreadsheet row) into one option fills that
  // option and the ones after it, adding options as needed.
  const onPaste = (e, index) => {
    const parts = splitPastedOptions(e.clipboardData?.getData('text') ?? '');
    if (parts.length < 2) return; // one line: an ordinary paste
    e.preventDefault();
    const options = [...q.options];
    const fit = parts.slice(0, MAX_OPTIONS - index);
    fit.forEach((text, j) => {
      const at = index + j;
      options[at] = options[at] ? { ...options[at], text } : { _id: newId(), text };
    });
    onChange({ ...q, options });
    if (fit.length < parts.length) toast(`Only ${MAX_OPTIONS} options fit; ${plural(parts.length - fit.length, 'line')} left out`, 'error');
  };
  const remove = (id) => onChange({ ...q, options: q.options.filter((o) => o._id !== id), correctAnswers: q.correctAnswers.filter((c) => c !== id) });
  const add = () => onChange({ ...q, options: [...q.options, { _id: newId(), text: '' }] });
  return (
    <fieldset className="space-y-2" disabled={locked}>
      <legend className="label">
        Options <span className="muted font-normal">· {multi ? 'tick every correct option' : 'choose the correct option'}</span>
      </legend>
      {!fixed && <p className="muted -mt-1 text-[12px]">Tip: copy all the options (one per line) and paste them into Option A - they fill every box at once.</p>}
      {q.options.map((o, i) => (
        <div key={o._id} className="flex items-center gap-2">
          <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center" title="Correct answer">
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={`correct-${q._id}`}
              checked={q.correctAnswers.includes(o._id)}
              onChange={() => toggle(o._id)}
              className="h-5 w-5 accent-[var(--ds-success)]"
              aria-label={`Option ${i + 1} is correct`}
            />
          </label>
          <span className="ds-num w-5 text-center text-[13px] font-semibold text-ds-fg-3" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
          <input
            className={cn('input', q.correctAnswers.includes(o._id) && 'border-success/60')}
            value={o.text}
            onChange={(e) => setText(o._id, e.target.value)}
            onPaste={fixed ? undefined : (e) => onPaste(e, i)}
            readOnly={fixed}
            maxLength={500}
            placeholder={`Option ${String.fromCharCode(65 + i)}`}
            aria-label={`Option ${String.fromCharCode(65 + i)} text`}
          />
          {!fixed && (
            <button type="button" className="btn-ghost min-h-11 min-w-11 p-2" onClick={() => remove(o._id)} disabled={q.options.length <= 2} aria-label={`Remove option ${String.fromCharCode(65 + i)}`}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {!fixed && q.options.length < MAX_OPTIONS && (
        <button type="button" className="btn-ghost text-[13px]" onClick={add}>
          <Plus className="h-4 w-4" /> Add option
        </button>
      )}
    </fieldset>
  );
}

/** Accepted answers of a short-answer question (any one counts), plus the number tolerance. */
function ShortAnswerEditor({ question: q, onChange, locked }) {
  const answers = q.correctAnswers.length ? q.correctAnswers : [''];
  const set = (i, v) => onChange({ ...q, correctAnswers: answers.map((a, j) => (j === i ? v : a)) });
  return (
    <fieldset className="space-y-2" disabled={locked}>
      <legend className="label">
        Accepted answers <span className="muted font-normal">· any one counts; not case-sensitive</span>
      </legend>
      {answers.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="input" value={a} maxLength={200} onChange={(e) => set(i, e.target.value)} placeholder={i ? 'Another accepted answer' : 'e.g. Ethosuximide, or 7.4'} aria-label={`Accepted answer ${i + 1}`} />
          {answers.length > 1 && (
            <button type="button" className="btn-ghost min-h-11 min-w-11 p-2" onClick={() => onChange({ ...q, correctAnswers: answers.filter((_, j) => j !== i) })} aria-label={`Remove accepted answer ${i + 1}`}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {answers.length < 10 && (
        <button type="button" className="btn-ghost text-[13px]" onClick={() => onChange({ ...q, correctAnswers: [...answers, ''] })}>
          <Plus className="h-4 w-4" /> Add another accepted answer
        </button>
      )}
      <div className="max-w-xs">
        <label className="label" htmlFor={`tol-${q._id}`}>
          Number tolerance (±) <span className="muted font-normal">· for numerical answers</span>
        </label>
        <input id={`tol-${q._id}`} type="number" min="0" step="any" className="input" value={q.numericTolerance} onChange={(e) => onChange({ ...q, numericTolerance: Number(e.target.value) || 0 })} />
      </div>
    </fieldset>
  );
}

/** A picture for the question: upload a file, or paste a web link. */
function ImageField({ question: q, onChange, locked }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const file = useRef(null);
  const upload = async (f) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast('Images can be up to 5 MB', 'error');
    setBusy(true);
    try {
      onChange({ ...q, image: await uploadQuestionImage(f) });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  if (q.image) {
    return (
      <div className="flex items-start gap-3">
        <img src={assetUrl(q.image)} alt="Question" className="max-h-40 rounded-[8px] border border-line object-contain" />
        {!locked && (
          <button type="button" className="btn-ghost text-[13px]" onClick={() => onChange({ ...q, image: '' })}>
            <Trash2 className="h-4 w-4" /> Remove image
          </button>
        )}
      </div>
    );
  }
  if (locked) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <button type="button" className="btn-secondary text-[13px]" disabled={busy} onClick={() => file.current?.click()}>
        <ImagePlus className="h-4 w-4" /> {busy ? 'Uploading…' : 'Add image'}
      </button>
      <span className="muted text-[13px]">or</span>
      <div className="flex min-w-[220px] flex-1 items-center gap-1.5">
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste an image link (https://…)" aria-label="Image link" />
        <button
          type="button"
          className="btn-ghost min-h-11 min-w-11 p-2"
          onClick={() => (/^https?:\/\//i.test(url.trim()) ? onChange({ ...q, image: url.trim() }) : toast('Use a link that starts with https://', 'error'))}
          aria-label="Use this image link"
        >
          <Link2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * One question in the editor. Drag the grip (or use the arrows) to reorder; everything is
 * disabled once people have started the test (`locked`).
 */
export default function QuestionEditor({ question: q, index, total, onChange, onDelete, onMove, onDuplicate, locked, dragHandlers, dragging }) {
  return (
    <article className={cn('rounded-[14px] border border-line bg-surface p-4 sm:p-5', dragging && 'opacity-50')} aria-label={`Question ${index + 1}`} {...dragHandlers}>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        {!locked && (
          <span className="cursor-grab text-ds-fg-3 active:cursor-grabbing" title="Drag to reorder" aria-hidden="true">
            <GripVertical className="h-5 w-5" />
          </span>
        )}
        <h3 className="font-editorial text-[18px] font-medium">Question {index + 1}</h3>
        <div className="segmented ml-auto" role="radiogroup" aria-label="Question type">
          {QUESTION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={q.type === t.value}
              className={cn('segment', q.type === t.value && 'segment-active')}
              disabled={locked}
              onClick={() => onChange(convert(q, t.value))}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor={`qt-${q._id}`}>Question</label>
          <textarea id={`qt-${q._id}`} className="input min-h-24" value={q.text} maxLength={4000} disabled={locked} onChange={(e) => onChange({ ...q, text: e.target.value })} placeholder="e.g. A 24-year-old presents with… What is the most likely diagnosis?" />
        </div>
        <ImageField question={q} onChange={onChange} locked={locked} />
        {q.type === 'short' ? <ShortAnswerEditor question={q} onChange={onChange} locked={locked} /> : <OptionEditor question={q} onChange={onChange} locked={locked} />}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor={`qm-${q._id}`}>Marks</label>
            <input id={`qm-${q._id}`} type="number" min="0.25" step="0.25" className="input" disabled={locked} value={q.marks} onChange={(e) => onChange({ ...q, marks: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label" htmlFor={`qn-${q._id}`}>Negative marks</label>
            <input id={`qn-${q._id}`} type="number" min="0" step="0.25" className="input" disabled={locked} value={q.negativeMarks} onChange={(e) => onChange({ ...q, negativeMarks: Number(e.target.value) || 0 })} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor={`ql-${q._id}`}>Time limit (seconds)</label>
            <input id={`ql-${q._id}`} type="number" min="0" step="5" className="input" disabled={locked} value={q.timeLimitSec} onChange={(e) => onChange({ ...q, timeLimitSec: Math.max(0, Math.round(Number(e.target.value) || 0)) })} placeholder="0 = none" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`qe-${q._id}`}>
            Explanation <span className="muted font-normal">· shown in the review after results are released (optional)</span>
          </label>
          <textarea id={`qe-${q._id}`} className="input min-h-20" value={q.explanation} maxLength={4000} disabled={locked} onChange={(e) => onChange({ ...q, explanation: e.target.value })} />
        </div>
      </div>

      {!locked && (
        <footer className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          <button type="button" className="btn-ghost min-h-11 min-w-11 p-2" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move question up">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" className="btn-ghost min-h-11 min-w-11 p-2" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move question down">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" className="btn-ghost text-[13px]" onClick={onDuplicate}>
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          <button type="button" className="btn-danger ml-auto text-[13px]" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </footer>
      )}
    </article>
  );
}
