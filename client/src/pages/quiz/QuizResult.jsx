import { Link, useParams } from 'react-router-dom';
import { Ban, Check, CheckCircle2, Clock, Hourglass, Trophy, X, XCircle } from 'lucide-react';
import { PageShell } from '../../components/Layout';
import { ErrorState, PageLoader } from '../../components/ui';
import { StatTile, StatusChip } from '../../components/quiz/QuizBits';
import { Bars, CompareBars, OutcomeDonut } from '../../components/quiz/StatsCharts';
import Leaderboard from '../../components/quiz/Leaderboard';
import { useAttemptResult } from '../../hooks/useQuiz';
import { assetUrl } from '../../api/client';
import { fmtDateTime, fmtDuration } from '../../lib/quiz';
import { cn } from '../../lib/format';

/** Score, rank, percentile, pass / fail, the counts and the time. */
export function ResultSummary({ a }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <StatTile label="Score" value={`${a.score} / ${a.maxScore}`} sub={`${a.percentage}%`} tone={a.status === 'disqualified' ? 'danger' : a.passed ? 'success' : undefined} />
      <StatTile label="Result" value={a.status === 'disqualified' ? 'DQ' : a.passed ? 'Pass' : 'Fail'} tone={a.status === 'disqualified' ? 'danger' : a.passed ? 'success' : 'danger'} />
      <StatTile label="Rank" value={a.rank ? `${a.rank} / ${a.rankedOutOf}` : '—'} sub={a.percentile != null ? `${a.percentile} percentile` : a.status === 'disqualified' ? 'not ranked' : ''} />
      <StatTile label="Time taken" value={fmtDuration(a.timeTakenSec)} />
      <StatTile label="Correct" value={a.correctCount} tone="success" />
      <StatTile label="Incorrect" value={a.wrongCount} tone={a.wrongCount ? 'danger' : undefined} />
      <StatTile label="Unattempted" value={a.unattemptedCount} />
      <StatTile label="Negative marks" value={a.negativeLost ? `−${a.negativeLost}` : '0'} />
    </div>
  );
}

function ReviewItem({ r }) {
  const tone = r.outcome === 'correct' ? 'text-success' : r.outcome === 'partial' ? 'text-warning' : r.outcome === 'wrong' ? 'text-danger' : 'text-ds-fg-3';
  const Icon = r.outcome === 'correct' ? CheckCircle2 : r.outcome === 'wrong' ? XCircle : r.outcome === 'partial' ? CheckCircle2 : Clock;
  const known = Array.isArray(r.correctAnswers);
  return (
    <article className="rounded-[14px] border border-line p-4 sm:p-5">
      <header className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="ds-eyebrow">Question {r.number}</span>
        <span className={cn('inline-flex items-center gap-1 font-medium capitalize', tone)}>
          <Icon className="h-4 w-4" /> {r.outcome === 'unattempted' ? 'Not answered' : r.outcome}
        </span>
        <span className="ds-num muted">{r.marksAwarded > 0 ? '+' : ''}{r.marksAwarded} / {r.marks}</span>
        <span className="muted ml-auto">{fmtDuration(r.timeSpentSec)}</span>
      </header>
      <p className="whitespace-pre-wrap text-[16px] leading-6 text-ink">{r.text}</p>
      {r.image && <img src={assetUrl(r.image)} alt="" className="mt-2 max-h-64 rounded-[8px] border border-line object-contain" />}
      {r.type === 'short' ? (
        <div className="mt-3 space-y-1 text-[15px]">
          <p>Your answer: <strong className={tone}>{r.selected[0] || '—'}</strong></p>
          {known && <p>Accepted: <strong className="text-success">{r.correctAnswers.join(' / ')}</strong></p>}
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {r.options.map((o, i) => {
            const mine = r.selected.includes(o._id);
            const right = known && r.correctAnswers.includes(o._id);
            return (
              <li key={o._id} className={cn('flex items-center gap-2.5 rounded-[10px] border px-3 py-2 text-[15px]', right ? 'border-success/50 bg-success-soft' : mine ? 'border-danger/40 bg-danger-soft' : 'border-line')}>
                <span className="ds-num w-5 text-center text-[13px] font-semibold text-ds-fg-3">{String.fromCharCode(65 + i)}</span>
                <span className="flex-1">{o.text}</span>
                {mine && <span className="muted text-[12px]">your answer</span>}
                {right ? <Check className="h-4 w-4 text-success" aria-label="correct" /> : mine ? <X className="h-4 w-4 text-danger" aria-label="incorrect" /> : null}
              </li>
            );
          })}
        </ul>
      )}
      {r.explanation && (
        <p className="mt-3 rounded-[10px] bg-surface-2 px-3 py-2 text-[14px] leading-6 text-ds-fg-2">
          <strong className="text-ink">Explanation: </strong>
          {r.explanation}
        </p>
      )}
    </article>
  );
}

/** My result for one attempt (/quiz/attempt/:attemptId/result). */
export default function QuizResult() {
  const { attemptId } = useParams();
  const { data, isPending, isError, error, refetch } = useAttemptResult(attemptId);
  if (isPending) return <PageShell title="Result"><PageLoader /></PageShell>;
  if (isError) return <PageShell title="Result"><ErrorState error={error} onRetry={refetch} /></PageShell>;
  const { quiz } = data;

  if (data.inProgress) {
    return (
      <PageShell title={quiz.title}>
        <div className="px-6 py-12 text-center">
          <p className="text-[15px]">This attempt is still in progress.</p>
          <Link to={`/quiz/${quiz._id}/instructions`} className="btn-primary mt-4">Back to the test</Link>
        </div>
      </PageShell>
    );
  }

  if (!data.released) {
    const a = data.attempt;
    return (
      <PageShell title={quiz.title} docTitle={`Result · ${quiz.title}`}>
        <div className="mx-auto max-w-md px-6 py-12 text-center">
          <span className={cn('mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full', a.status === 'disqualified' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}>
            {a.status === 'disqualified' ? <Ban className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
          </span>
          <h2 className="font-editorial text-[24px] font-medium">{a.status === 'disqualified' ? 'Submitted after disqualification' : 'Submitted successfully'}</h2>
          {a.disqualifiedReason && <p className="mt-2 text-[14px] text-danger">{a.disqualifiedReason}</p>}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[15px] text-ds-fg-2">
            <Hourglass className="h-4 w-4" /> Results will be available on {fmtDateTime(data.availableAt)}.
          </p>
          <Link to="/quiz?tab=attempts" className="btn-secondary mt-6">My attempts</Link>
        </div>
      </PageShell>
    );
  }

  const a = data.attempt;
  const c = data.comparison;
  return (
    <PageShell title={quiz.title} docTitle={`Result · ${quiz.title}`} subtitle={`${quiz.organizer?.name ? `by ${quiz.organizer.name} · ` : ''}submitted ${fmtDateTime(a.submittedAt)}`} wide>
      <div className="space-y-6 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={a.status} />
          {a.reinstatedAt && <span className="muted text-[13px]">Reinstated by the organizer</span>}
        </div>
        {a.disqualifiedReason && a.status === 'disqualified' && <p className="rounded-[12px] bg-danger-soft px-4 py-3 text-[14px] text-danger" role="note">{a.disqualifiedReason}. Your answers up to that point were scored; disqualified attempts are not ranked.</p>}
        <ResultSummary a={a} />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[14px] border border-line p-4 sm:p-5" aria-label="Answers breakdown">
            <h2 className="mb-3 text-[15px] font-semibold">Your answers</h2>
            <OutcomeDonut correct={a.correctCount} wrong={a.wrongCount} unattempted={a.unattemptedCount} />
          </section>
          <section className="rounded-[14px] border border-line p-4 sm:p-5" aria-label="Compared with others">
            <h2 className="mb-3 text-[15px] font-semibold">Compared with {c.participants} {c.participants === 1 ? 'participant' : 'participants'}</h2>
            <CompareBars max={a.maxScore} rows={[{ label: 'You', value: a.score, accent: true }, { label: 'Class average', value: c.average }, { label: 'Highest', value: c.highest }]} />
          </section>
        </div>

        <section className="rounded-[14px] border border-line p-4 sm:p-5" aria-label="Time per question">
          <h2 className="mb-3 text-[15px] font-semibold">Time per question</h2>
          <Bars title="Seconds spent on each question" items={data.review.map((r) => ({ label: `Question ${r.number}`, short: r.number, value: r.timeSpentSec }))} valueLabel={(v) => `${v}s`} highlight={(it, i) => data.review[i].outcome === 'wrong'} />
          <p className="muted mt-1 text-[12px]">Coral bars: questions you got wrong.</p>
        </section>

        {data.leaderboard && (
          <section className="overflow-hidden rounded-[14px] border border-line" aria-label="Leaderboard">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-[15px] font-semibold"><Trophy className="h-4 w-4 text-ds-accent-text" /> Leaderboard</h2>
            <Leaderboard rows={data.leaderboard} />
          </section>
        )}

        <section className="space-y-3" aria-label="Question review">
          <h2 className="font-editorial text-[22px] font-medium">Review</h2>
          {!data.review[0]?.correctAnswers && <p className="muted text-[14px]">The organizer has chosen not to show the correct answers.</p>}
          {data.review.map((r) => <ReviewItem key={r._id} r={r} />)}
        </section>
      </div>
    </PageShell>
  );
}
