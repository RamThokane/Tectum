import { useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw, Eye, Check, ChevronUp, Lightbulb } from 'lucide-react';
import { pickExaminerSet } from '../lib/examinerQuestions';
import { cn } from '../lib/format';

/**
 * Home page "Examiner": five practical exam questions as small boxes.
 * Clicking a box expands it to the full question, with a reveal for the model answer.
 */
export default function Examiner() {
  const [offset, setOffset] = useState(0);
  const questions = useMemo(() => pickExaminerSet(5, offset), [offset]);
  const [openId, setOpenId] = useState(null);
  const [revealed, setRevealed] = useState(() => new Set());
  const [viewed, setViewed] = useState(() => new Set());

  const toggle = (id) => {
    setOpenId((cur) => (cur === id ? null : id));
    setViewed((v) => new Set(v).add(id));
  };
  const reveal = (id) => setRevealed((r) => new Set(r).add(id));
  const newSet = () => {
    setOffset((o) => o + 1);
    setOpenId(null);
    setRevealed(new Set());
    setViewed(new Set());
  };

  const viewedCount = questions.filter((q) => viewed.has(q.id)).length;

  return (
    <section id="examiner" className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-full border border-line p-2 text-link">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-editorial font-medium">Examiner</h2>
            <p className="muted text-[12px]">5 practical exam questions for today · {viewedCount}/5 viewed</p>
          </div>
        </div>
        <button onClick={newSet} className="btn-ghost px-2.5 py-1.5 text-[12px]" title="Show 5 different questions">
          <RefreshCw className="h-3.5 w-3.5" /> New set
        </button>
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {questions.map((item, i) => {
          const open = openId === item.id;
          const seen = viewed.has(item.id);
          if (!open) {
            return (
              <li key={item.id}>
                <button
                  onClick={() => toggle(item.id)}
                  aria-expanded="false"
                  className="group flex h-full w-full flex-col rounded-[12px] bg-surface-2 p-3 text-left ring-1 ring-inset ring-line transition hover:-translate-y-0.5 hover:bg-ds-brand-soft hover:ring-line-strong"
                >
                  <span className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ds-brand-soft text-[12px] font-semibold text-ds-brand-text">
                      {i + 1}
                    </span>
                    {seen && <Check className="h-4 w-4 text-success" aria-label="Viewed" />}
                  </span>
                  <span className="mt-2 text-[10.5px] font-semibold uppercase tracking-wide text-ds-fg-3">{item.subject}</span>
                  <span className="mt-0.5 line-clamp-3 text-[12px] font-medium leading-snug">{item.q}</span>
                </button>
              </li>
            );
          }
          const shown = revealed.has(item.id);
          return (
            <li key={item.id} className="col-span-full">
              <div className="rounded-[12px] bg-ds-brand-soft p-4 ring-1 ring-inset ring-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ds-brand-text">
                    Question {i + 1} · {item.subject}
                  </p>
                  <button onClick={() => toggle(item.id)} className="btn-ghost -mr-2 -mt-1 p-1.5" aria-label="Collapse question">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1.5 text-[15px] font-semibold leading-snug">{item.q}</p>

                {!shown ? (
                  <button onClick={() => reveal(item.id)} className="btn-primary mt-4 px-3.5 py-1.5 text-[13px]">
                    <Eye className="h-4 w-4" /> Think first, then reveal answer
                  </button>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-[13px] leading-relaxed">{item.a}</p>
                    <div className="rounded-[6px] bg-white/70 p-3">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-warning">
                        <Lightbulb className="h-3.5 w-3.5" /> Key points for the examiner
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {item.points.map((p) => (
                          <li key={p} className="flex gap-2 text-[13px]">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {i < questions.length - 1 && (
                      <button onClick={() => toggle(questions[i + 1].id)} className={cn('text-[13px] font-semibold text-ds-brand-text hover:underline')}>
                        Next question →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="muted mt-3 text-[12px]">For revision only. Always follow your curriculum and local guidelines.</p>
    </section>
  );
}
