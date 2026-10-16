import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, Download, ExternalLink, Link2, Pencil, RefreshCw, Send, ShieldAlert, UserCheck, Users, X } from 'lucide-react';
import { PageShell } from '../../components/Layout';
import { EmptyState, ErrorState, PageLoader, Toggle } from '../../components/ui';
import Avatar from '../../components/Avatar';
import { CodeBox, StatTile, StatusChip } from '../../components/quiz/QuizBits';
import { AccuracyList, Bars } from '../../components/quiz/StatsCharts';
import InviteUsersModal from '../../components/quiz/InviteUsersModal';
import { useDecideRegistrations, useQuizAction, useQuizForOrganizer, useQuizResults, useRegistrations } from '../../hooks/useQuiz';
import { api } from '../../api/client';
import { FULLSCREEN_REQUIRED, fmtDateTime, fmtDuration, plural } from '../../lib/quiz';
import { cn } from '../../lib/format';
import { toast } from '../../store/ui';

/** Downloads the results table (through the API client, so it works with either sign-in method). */
async function exportCsv(id, title) {
  try {
    const { data } = await api.get(`/quizzes/${id}/results/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w-]+/g, '-').slice(0, 50) || 'test'}-results.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function ShareCard({ quiz }) {
  const { regenerate, joinable } = useQuizAction(quiz._id);
  const [inviteOpen, setInviteOpen] = useState(false);
  const listed = quiz.settings?.listed;
  const link = listed ? `${window.location.origin}/quiz/${quiz._id}/details` : `${window.location.origin}/quiz/join?code=${quiz.accessCode}`;
  return (
    <section className="space-y-4 px-4 py-5 sm:px-6" aria-label="Share">
      {listed ? (
        <p className="rounded-[12px] bg-ds-brand-soft px-4 py-3 text-[14px] text-ink">
          This test is on your profile (Tests tab) and in Tests → Quizzes. Students register there; accept them below and they can start it when it goes live.{' '}
          <Link to={`/quiz/${quiz._id}/details`} className="inline-flex items-center gap-1 font-medium text-link hover:underline">
            See its page <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </p>
      ) : (
        <CodeBox code={quiz.accessCode} />
      )}
      <div className="flex flex-wrap gap-2">
        <button className={listed ? 'btn-secondary' : 'btn-primary'} onClick={() => setInviteOpen(true)}>
          <Send className="h-4 w-4" /> {listed ? 'Invite members directly' : 'Send code via DM / notification'}
        </button>
        <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(link).then(() => toast(listed ? 'Link to the test page copied' : 'Join link copied'))}>
          <Link2 className="h-4 w-4" /> {listed ? 'Copy link to register' : 'Copy join link'}
        </button>
        {!listed && (
          <button
            className="btn-ghost"
            disabled={regenerate.isPending}
            onClick={() => window.confirm('Make a new code? The current code stops working immediately, for everyone who has not started yet.') && regenerate.mutate(undefined, { onSuccess: () => toast('New code ready') })}
          >
            <RefreshCw className="h-4 w-4" /> New code
          </button>
        )}
      </div>
      <div className="rounded-[12px] border border-line">
        <Toggle
          label={listed ? 'Open for registration and starting' : 'Open to participants'}
          description={
            quiz.isJoinable
              ? listed
                ? 'Students can register, and accepted ones can start (within the test window).'
                : 'People with the code can join and start (within the test window).'
              : 'Closed: nobody new can register or start. People already taking it can finish.'
          }
          checked={quiz.isJoinable}
          onChange={(v) => joinable.mutate(v)}
        />
      </div>
      <p className="muted text-[13px]">
        {listed ? 'Registered and accepted members' : quiz.settings?.inviteOnly ? 'Invited members only' : 'Anyone with the code'} · opens {fmtDateTime(quiz.startTime)} · closes {fmtDateTime(quiz.endTime)}
      </p>
      <InviteUsersModal quiz={quiz} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </section>
  );
}

const REG_FILTERS = [
  ['pending', 'Waiting'],
  ['accepted', 'Accepted'],
  ['rejected', 'Declined'],
];

/** Listed tests: who asked to take it (name, college), with Accept / Decline and "Accept all". */
function Registrations({ quiz }) {
  const { data, isPending, isError, error, refetch } = useRegistrations(quiz._id);
  const decide = useDecideRegistrations(quiz._id);
  const [filter, setFilter] = useState('pending');
  // from the "asked to take your test" notification: jump here
  const [params] = useSearchParams();
  const jump = params.get('tab') === 'registrations';
  useEffect(() => {
    if (jump && !isPending) document.getElementById('registrations')?.scrollIntoView({ block: 'start' });
  }, [jump, isPending]);
  if (isPending) return <PageLoader count={1} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const rows = data.registrations.filter((r) => r.status === filter);
  const pendingIds = data.registrations.filter((r) => r.status === 'pending').map((r) => r._id);
  const act = (ids, action) => decide.mutate({ ids, action });
  return (
    <section id="registrations" className="border-t border-line px-4 py-5 sm:px-6" aria-labelledby="regs-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="regs-title" className="font-editorial text-[20px] font-medium">Registrations</h2>
        <span className="muted text-[13px]">
          {data.counts.accepted} accepted{data.maxParticipants ? ` of ${data.maxParticipants} places` : ''}
        </span>
        {pendingIds.length > 1 && (
          <button className="btn-primary ml-auto min-h-9 px-3 text-[13px]" disabled={decide.isPending} onClick={() => window.confirm(`Accept all ${pendingIds.length} waiting requests?`) && act(pendingIds, 'accept')}>
            <UserCheck className="h-4 w-4" /> Accept all ({pendingIds.length})
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Show">
        {REG_FILTERS.map(([id, label]) => (
          <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)} className={cn('chip min-h-9 px-3 text-[13px]', filter === id ? 'border-link bg-ds-brand-soft text-link' : 'bg-surface hover:bg-surface-2')}>
            {label} ({data.counts[id]})
          </button>
        ))}
      </div>
      {!rows.length ? (
        <p className="muted py-6 text-center text-[14px]">
          {filter === 'pending' ? (data.registrations.length ? 'No requests waiting.' : 'No one has registered yet. The test is on your profile, in the Tests tab.') : 'None.'}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <li key={r._id} className="flex flex-wrap items-center gap-3 py-3">
              {r.user && <Avatar user={r.user} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">
                  {r.name}
                  {r.user?.username && (
                    <Link to={`/profile/${r.user._id}`} className="muted ml-1.5 text-[13px] font-normal hover:underline">@{r.user.username}</Link>
                  )}
                </p>
                <p className="muted truncate text-[13px]">{r.college} · {fmtDateTime(r.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                {r.status !== 'accepted' && (
                  <button className="btn-primary min-h-9 px-3 text-[13px]" disabled={decide.isPending} onClick={() => act([r._id], 'accept')}>
                    <Check className="h-4 w-4" /> Accept
                  </button>
                )}
                {r.status !== 'rejected' && (
                  <button
                    className="btn-secondary min-h-9 px-3 text-[13px] text-danger"
                    disabled={decide.isPending}
                    onClick={() => (r.status === 'pending' || window.confirm(`Remove ${r.name} from this test?`)) && act([r._id], 'reject')}
                  >
                    <X className="h-4 w-4" /> {r.status === 'accepted' ? 'Remove' : 'Decline'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stats({ stats, quiz }) {
  if (!stats.participants && !stats.disqualified) return null;
  return (
    <section className="space-y-5 border-t border-line px-4 py-5 sm:px-6" aria-label="Statistics">
      <h2 className="font-editorial text-[20px] font-medium">Statistics</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Average" value={stats.average} sub={`of ${stats.maxScore}`} />
        <StatTile label="Highest" value={stats.highest} />
        <StatTile label="Lowest" value={stats.lowest} />
        <StatTile label="Median" value={stats.median} />
        <StatTile label="Pass rate" value={`${stats.passRate}%`} sub={`pass mark ${quiz.settings?.passPercent ?? 0}%`} />
        <StatTile label="Ranked" value={stats.participants} />
        <StatTile label="Disqualified" value={stats.disqualified} tone={stats.disqualified ? 'danger' : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[14px] font-semibold">Score distribution (%)</h3>
          <Bars title="Participants per score band" items={stats.histogram.map((h) => ({ label: `${h.from}-${h.to}%`, short: h.from, value: h.count }))} />
        </div>
        <div>
          <h3 className="mb-2 text-[14px] font-semibold">Average time per question</h3>
          <Bars title="Average seconds per question" color="var(--ds-info)" items={stats.perQuestion.map((q) => ({ label: `Question ${q.number}`, short: q.number, value: q.avgTimeSec }))} valueLabel={(v) => `${v}s`} />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-[14px] font-semibold">Accuracy per question <span className="muted font-normal">· hardest first</span></h3>
        <AccuracyList items={stats.perQuestion} />
      </div>
    </section>
  );
}

function ResultsTable({ quizId, attempts, listed }) {
  if (!attempts.length) {
    return (
      <EmptyState icon={Users} title="No participants yet">
        {listed ? 'Accept registrations above.' : 'Share the code.'} Results appear here as people take the test (this page refreshes by itself).
      </EmptyState>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[14px]">
        <thead className="border-b border-line text-[12px] uppercase tracking-wide text-ds-fg-3">
          <tr>
            <th className="px-4 py-2.5 font-medium">Rank</th>
            <th className="px-2 py-2.5 font-medium">Participant</th>
            <th className="px-2 py-2.5 font-medium">Score</th>
            <th className="px-2 py-2.5 font-medium">%</th>
            <th className="px-2 py-2.5 font-medium">Time</th>
            <th className="px-2 py-2.5 font-medium">Status</th>
            <th className="px-2 py-2.5 font-medium">Violations</th>
            <th className="px-4 py-2.5 font-medium">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {attempts.map((a) => (
            <tr key={a._id} className="hover:bg-surface-2">
              <td className="ds-num px-4 py-2.5 font-semibold">{a.rank ?? '—'}</td>
              <td className="px-2 py-2.5">
                <Link to={`/quiz/${quizId}/results/${a._id}`} className="flex items-center gap-2 text-ink hover:underline">
                  {a.user && <Avatar user={a.user} size="xs" />}
                  <span className="truncate">{a.user?.name ?? 'Deleted member'}</span>
                  {a.attemptNumber > 1 && <span className="muted text-[12px]">#{a.attemptNumber}</span>}
                  {a.mode === 'phone' && FULLSCREEN_REQUIRED && <span className="chip border-ds-line text-[11px] text-ds-fg-3" title="Taken on an iPhone or iPad without full screen (its browser doesn't allow it); leaving the page was watched instead">iPhone/iPad mode</span>}
                </Link>
              </td>
              <td className="ds-num px-2 py-2.5">{a.status === 'in_progress' ? '—' : `${a.score} / ${a.maxScore}`}</td>
              <td className="ds-num px-2 py-2.5">{a.status === 'in_progress' ? '—' : `${a.percentage}%`}</td>
              <td className="px-2 py-2.5">{a.status === 'in_progress' ? '—' : fmtDuration(a.timeTakenSec)}</td>
              <td className="px-2 py-2.5"><StatusChip status={a.status} /></td>
              <td className={cn('ds-num px-2 py-2.5', a.countedViolations ? 'text-danger' : 'text-ds-fg-3')}>
                {a.violations ? (
                  <span className="inline-flex items-center gap-1">
                    {a.countedViolations > 0 && <ShieldAlert className="h-3.5 w-3.5" />}
                    {a.violations}
                  </span>
                ) : (
                  0
                )}
              </td>
              <td className="muted px-4 py-2.5 text-[13px]">{a.submittedAt ? fmtDateTime(a.submittedAt) : 'In progress'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The organizer's page for one published test: code, invitations, live results and statistics. */
export default function QuizManage() {
  const { id } = useParams();
  const quiz = useQuizForOrganizer(id);
  const results = useQuizResults(id);
  if (quiz.isPending) return <PageShell title="Manage test" wide><PageLoader /></PageShell>;
  if (quiz.isError) return <PageShell title="Manage test" wide><ErrorState error={quiz.error} onRetry={quiz.refetch} /></PageShell>;
  const q = quiz.data;
  return (
    <PageShell
      title={q.title}
      docTitle={`Manage · ${q.title}`}
      subtitle={`${plural(q.questions.length, 'question')} · ${q.totalMarks} marks · ${q.durationMinutes} min`}
      wide
      actions={
        <div className="flex items-center gap-2">
          <StatusChip phase={q.phase} />
          <Link to={`/quiz/${id}/edit`} className="btn-ghost min-h-9 px-3 text-[14px]"><Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Edit</span></Link>
        </div>
      }
    >
      {q.status !== 'published' ? (
        <EmptyState icon={Send} title="Not published yet" action={<Link to={`/quiz/${id}/edit?step=4`} className="btn-primary">Review and publish</Link>}>
          Publish the test to get its access code.
        </EmptyState>
      ) : (
        <>
          <ShareCard quiz={q} />
          {q.settings?.listed && <Registrations quiz={q} />}
          {results.data && <Stats stats={results.data.stats} quiz={q} />}
          <section className="border-t border-line" aria-label="Results">
            <div className="flex items-center gap-2 px-4 pt-5 sm:px-6">
              <h2 className="font-editorial text-[20px] font-medium">Participants</h2>
              <button className="btn-secondary ml-auto min-h-9 px-3 text-[13px]" onClick={() => exportCsv(id, q.title)}>
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>
            {results.isPending ? <PageLoader count={2} /> : results.isError ? <ErrorState error={results.error} onRetry={results.refetch} /> : <ResultsTable quizId={id} attempts={results.data.attempts} listed={q.settings?.listed} />}
          </section>
        </>
      )}
    </PageShell>
  );
}
