import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, RotateCcw, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { PageShell } from '../../components/Layout';
import { ErrorState, Modal, PageLoader } from '../../components/ui';
import Avatar from '../../components/Avatar';
import { StatTile, StatusChip } from '../../components/quiz/QuizBits';
import { useAttemptDetail, useReinstate } from '../../hooks/useQuiz';
import { assetUrl } from '../../api/client';
import { FULLSCREEN_REQUIRED, VIOLATION_LABELS, fmtClock, fmtDateTime, fmtDuration } from '../../lib/quiz';
import { cn } from '../../lib/format';

function ReinstateModal({ open, onClose, quizId, attemptId, name }) {
  const [mode, setMode] = useState('retake');
  const [note, setNote] = useState('');
  const reinstate = useReinstate(quizId, attemptId);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reinstate ${name}?`}
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={reinstate.isPending} onClick={() => reinstate.mutate({ mode, note }, { onSuccess: onClose })}>
            Reinstate
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-5 py-4">
        <p className="text-[14px] text-ds-fg-2">Use this if the disqualification was a genuine mistake (an accidental Esc, a browser crash). It is recorded.</p>
        {[
          ['retake', 'Let them take it again', 'This attempt is set aside; they can start a new one while the test is open.'],
          ['count', 'Count this attempt', 'Score and rank them on the answers they gave before the disqualification.'],
        ].map(([value, title, desc]) => (
          <label key={value} className={cn('flex cursor-pointer gap-3 rounded-[12px] border p-3', mode === value ? 'border-ds-brand bg-ds-brand-soft' : 'border-line')}>
            <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 h-4 w-4 accent-[var(--ds-brand)]" />
            <span>
              <span className="block text-[15px] font-medium text-ink">{title}</span>
              <span className="muted block text-[13px]">{desc}</span>
            </span>
          </label>
        ))}
        <div>
          <label className="label" htmlFor="reinstate-note">Note (optional)</label>
          <input id="reinstate-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pressed Esc by mistake - confirmed by message" />
        </div>
      </div>
    </Modal>
  );
}

/** Organizer's view of one participant's attempt: score, every answer, and the violation log. */
export default function AttemptReview() {
  const { id, attemptId } = useParams();
  const { data, isPending, isError, error, refetch } = useAttemptDetail(id, attemptId);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  if (isPending) return <PageShell title="Attempt" wide><PageLoader /></PageShell>;
  if (isError) return <PageShell title="Attempt" wide><ErrorState error={error} onRetry={refetch} /></PageShell>;
  const a = data.attempt;
  const name = a.user?.name ?? 'Deleted member';
  return (
    <PageShell
      title={name}
      docTitle={`Attempt · ${name}`}
      subtitle={`Attempt ${a.attemptNumber} · started ${fmtDateTime(a.startedAt)}`}
      wide
      actions={<Link to={`/quiz/${id}/manage`} className="btn-ghost min-h-9 px-3 text-[14px]"><ArrowLeft className="h-4 w-4" /> Results</Link>}
    >
      <div className="space-y-6 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          {a.user && <Avatar user={a.user} size="md" />}
          <StatusChip status={a.status} />
          {/* only worth pointing out while full screen is the rule (it's switched off for now) */}
          {a.mode === 'phone' && FULLSCREEN_REQUIRED && (
            <span className="chip border-ds-line text-ds-fg-2" title="This iPhone/iPad browser doesn't allow full screen; leaving the test page (apps, tabs, home screen) was watched instead">
              iPhone/iPad mode · no full screen
            </span>
          )}
          {a.reinstatedAt && (
            <span className="muted text-[13px]">
              Reinstated by {a.reinstatedBy?.name ?? 'the organizer'} {fmtDateTime(a.reinstatedAt)}
              {a.reinstateNote ? ` · "${a.reinstateNote}"` : ''}
            </span>
          )}
          {a.status === 'disqualified' && (
            <button className="btn-secondary ml-auto" onClick={() => setReinstateOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Reinstate
            </button>
          )}
        </div>
        {a.disqualifiedReason && <p className="rounded-[12px] bg-danger-soft px-4 py-3 text-[14px] text-danger" role="note">{a.disqualifiedReason}</p>}

        {a.status !== 'in_progress' && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile label="Score" value={`${a.score} / ${a.maxScore}`} sub={`${a.percentage}%`} tone={a.passed ? 'success' : undefined} />
            <StatTile label="Rank" value={a.rank ?? '—'} />
            <StatTile label="Correct / wrong" value={`${a.correctCount} / ${a.wrongCount}`} sub={`${a.unattemptedCount} unattempted · ${a.negativeLost ? `−${a.negativeLost} negative` : 'no negative marks'}`} />
            <StatTile label="Time taken" value={fmtDuration(a.timeTakenSec)} />
          </div>
        )}

        <section aria-label="Activity log">
          <h2 className="mb-2 flex items-center gap-2 font-editorial text-[20px] font-medium">
            {a.violations.length ? <ShieldAlert className="h-5 w-5 text-danger" /> : <ShieldCheck className="h-5 w-5 text-success" />} Activity log
          </h2>
          {a.violations.length ? (
            <ol className="divide-y divide-line rounded-[12px] border border-line">
              {a.violations.map((v, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                  <span className="ds-num font-mono text-ds-fg-2">{fmtClock(v.at)}</span>
                  <span className={cn('font-medium', v.counted ? 'text-danger' : 'text-ink')}>{VIOLATION_LABELS[v.type] ?? v.type}</span>
                  {v.counted && <span className="chip border-danger/40 text-danger">counts</span>}
                  {v.meta && <span className="muted text-[13px]">{v.meta}</span>}
                  {v.userAgent && <span className="muted w-full truncate text-[11px]" title={v.userAgent}>{v.userAgent}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted text-[14px]">No violations recorded.</p>
          )}
          <p className="muted mt-2 text-[12px]">Device: {a.userAgent || 'unknown'}</p>
        </section>

        <section aria-label="Answers" className="space-y-3">
          <h2 className="font-editorial text-[20px] font-medium">Answers</h2>
          {data.questions.map((q, i) => (
            <article key={q._id} className="rounded-[12px] border border-line p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="ds-eyebrow">Q{i + 1}</span>
                {q.outcome && (
                  <span className={cn('chip', q.outcome === 'correct' ? 'border-success/40 text-success' : q.outcome === 'partial' ? 'border-warning/40 text-warning' : q.outcome === 'wrong' ? 'border-danger/40 text-danger' : 'border-line text-ds-fg-3')}>
                    {q.outcome} {q.marksAwarded != null && `(${q.marksAwarded > 0 ? '+' : ''}${q.marksAwarded})`}
                  </span>
                )}
                <span className="muted">{fmtDuration(q.timeSpentSec)}</span>
              </div>
              <p className="whitespace-pre-wrap text-[15px] text-ink">{q.text}</p>
              {q.image && <img src={assetUrl(q.image)} alt="" className="mt-2 max-h-48 rounded-[8px] border border-line" />}
              {q.type === 'short' ? (
                <p className="mt-2 text-[14px]">
                  Answer: <strong>{q.selected[0] || '—'}</strong> <span className="muted">· accepted: {q.correctAnswers.join(', ')}</span>
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {q.options.map((o) => {
                    const chosen = q.selected.includes(o._id);
                    const right = q.correctAnswers.includes(o._id);
                    return (
                      <li key={o._id} className={cn('flex items-center gap-2 rounded-[8px] px-2 py-1 text-[14px]', right && 'bg-success-soft', chosen && !right && 'bg-danger-soft')}>
                        {right ? <Check className="h-4 w-4 text-success" /> : chosen ? <X className="h-4 w-4 text-danger" /> : <span className="w-4" />}
                        <span>{o.text}</span>
                        {chosen && <span className="muted ml-auto text-[12px]">their answer</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          ))}
        </section>
      </div>
      <ReinstateModal open={reinstateOpen} onClose={() => setReinstateOpen(false)} quizId={id} attemptId={attemptId} name={name} />
    </PageShell>
  );
}
