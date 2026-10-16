import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ChevronRight, ClipboardList, Copy, Hourglass, KeyRound, Plus, Trash2, CopyPlus, BarChart3, Radio, CalendarClock } from 'lucide-react';
import { PageShell } from '../../components/Layout';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui';
import Avatar from '../../components/Avatar';
import { Tick } from '../../components/VerificationBadge';
import { QuizCard, StatusChip } from '../../components/quiz/QuizBits';
import { TestAction } from '../../components/quiz/HostTests';
import { ApplyToHostModal, canHostTests, FREE_HOSTED_TESTS } from '../../components/quiz/Hosting';
import { useHostStatus, useHosts, useMyAttempts, useMyQuizzes, useMyRegistrations, useQuizAction } from '../../hooks/useQuiz';
import { useAuthStore } from '../../store/auth';
import { fmtDateTime, fmtDuration, plural } from '../../lib/quiz';
import { cn } from '../../lib/format';
import { toast } from '../../store/ui';

/** "Quizzes": the organisations and people approved to conduct tests; each opens its tests. */
function Organisations({ onApply }) {
  const user = useAuthStore((s) => s.user);
  const { data, isPending, isError, error, refetch } = useHosts();
  if (isPending) return <PageLoader />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const others = data.filter((h) => h._id !== user?._id);
  return (
    <>
      {!others.length ? (
        <EmptyState icon={Building2} title="No quiz organisers yet">
          Coaching institutes, colleges and teachers approved by Tectum will appear here with their upcoming tests.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {others.map((h) => (
            <li key={h._id}>
              <Link to={`/profile/${h._id}?tab=tests`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 sm:px-5">
                <Avatar user={h} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-ink">{h.name}</span>
                    <Tick user={h} className="h-4 w-4" />
                  </span>
                  <span className="muted block truncate text-[13px]">{h.username ? `@${h.username}` : ''}{h.institution ? ` · ${h.institution}` : ''}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5 text-[12px]">
                    {h.live > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 font-semibold text-white">
                        <Radio className="h-3 w-3" /> {h.live} live
                      </span>
                    )}
                    {h.upcoming > 0 && (
                      <span className="chip border-ds-brand/40 text-ds-brand-text">
                        <CalendarClock className="h-3 w-3" /> {h.upcoming} upcoming{h.nextStart ? ` · next ${fmtDateTime(h.nextStart)}` : ''}
                      </span>
                    )}
                    {!h.live && !h.upcoming && <span className="muted">{h.past ? plural(h.past, 'past test') : 'No tests yet'}</span>}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ds-fg-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!canHostTests(user) && (
        <div className="m-4 rounded-[14px] border border-line p-4 sm:mx-5">
          {user?.quizHost === 'pending' ? (
            <p className="flex items-start gap-2 text-[14px] text-ds-fg-2">
              <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> Your application to conduct quizzes is waiting for Tectum's approval. We'll notify you.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-[14px] text-ds-fg-2">
                <span className="block font-semibold text-ink">Conduct quizzes on Tectum</span>
                For coaching institutes, colleges and teachers. Your first {FREE_HOSTED_TESTS} quizzes are free.
              </p>
              <button className="btn-secondary" onClick={onApply}><Building2 className="h-4 w-4" /> Apply to host</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** The organizer's own tests ("Hosting"). */
function MyTests() {
  const { data, isPending, isError, error, refetch } = useMyQuizzes();
  const { data: status } = useHostStatus();
  const { remove, duplicate } = useQuizAction(null);
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);
  const navigate = useNavigate();
  if (isPending) return <PageLoader />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const freeNote = status?.canHost && !isAdmin && (
    <p className="muted border-b border-line px-4 py-2.5 text-[13px] sm:px-5">
      {status.freeLeft > 0 ? `${plural(status.freeLeft, 'free quiz', 'free quizzes')} left of ${status.freeTests}.` : `You've used your ${status.freeTests} free quizzes; a minimal upload charge applies to each new quiz you publish.`}
    </p>
  );
  if (!data.length) {
    return (
      <>
        {freeNote}
        <EmptyState icon={ClipboardList} title="No tests yet" action={<Link to="/quiz/create" className="btn-primary"><Plus className="h-4 w-4" /> Create a test</Link>}>
          Make a timed, proctored test. Listed tests appear on your profile for students to register; private ones are shared with a code.
        </EmptyState>
      </>
    );
  }
  const copyCode = (code) => navigator.clipboard.writeText(code).then(() => toast('Code copied'), () => toast(code));
  return (
    <>
      {freeNote}
      <ul className="divide-y divide-line">
        {data.map((q) => (
          <li key={q._id}>
            <QuizCard
              quiz={q}
              actions={
                <>
                  {q.status === 'published' ? (
                    <Link to={`/quiz/${q._id}/manage`} className="btn-secondary min-h-9 px-3 text-[13px]"><BarChart3 className="h-4 w-4" /> Manage</Link>
                  ) : (
                    <Link to={`/quiz/${q._id}/edit`} className="btn-secondary min-h-9 px-3 text-[13px]">Edit</Link>
                  )}
                  {q.accessCode && !q.settings?.listed && (
                    <button className="btn-ghost min-h-9 px-3 text-[13px]" onClick={() => copyCode(q.accessCode)} aria-label={`Copy code for ${q.title}`}>
                      <Copy className="h-4 w-4" /> <span className="ds-num font-mono">{q.accessCode}</span>
                    </button>
                  )}
                  <button
                    className="btn-ghost min-h-9 min-w-9 p-2"
                    title="Duplicate"
                    aria-label={`Duplicate ${q.title}`}
                    onClick={() => duplicate.mutate(q._id, { onSuccess: (copy) => navigate(`/quiz/${copy._id}/edit`) })}
                  >
                    <CopyPlus className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-ghost min-h-9 min-w-9 p-2 hover:text-danger"
                    title="Delete"
                    aria-label={`Delete ${q.title}`}
                    onClick={() =>
                      window.confirm(q.attemptCount ? 'Remove this test? People have taken it, so their own results stay available to them.' : 'Delete this test for good?') &&
                      remove.mutate(q._id, { onSuccess: (d) => toast(d.message) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Tests I registered for that haven't ended: pending, registered, or live with Start Test. */
function MyRegistrations() {
  const { data } = useMyRegistrations();
  if (!data?.length) return null;
  return (
    <section aria-labelledby="my-regs" className="border-b border-line">
      <h2 id="my-regs" className="ds-eyebrow px-4 pt-4 sm:px-5">Registered tests</h2>
      <ul className="divide-y divide-line">
        {data.map((q) => (
          <li key={q._id} className={cn('flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5', q.phase === 'live' && 'bg-success-soft/40')}>
            <Link to={`/quiz/${q._id}/details`} className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate font-editorial text-[17px] font-medium text-ink hover:underline">{q.title}</span>
                <StatusChip phase={q.phase} />
              </span>
              <span className="muted block text-[13px]">
                {q.organizer?.name ? `by ${q.organizer.name} · ` : ''}
                {q.phase === 'live' ? `closes ${fmtDateTime(q.endTime)}` : `opens ${fmtDateTime(q.startTime)}`}
              </span>
            </Link>
            <TestAction quiz={q} size="sm" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MyAttempts() {
  const { data, isPending, isError, error, refetch } = useMyAttempts();
  if (isPending) return <PageLoader />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <>
      <MyRegistrations />
      {!data.length ? (
        <EmptyState icon={KeyRound} title="You haven't taken a test yet" action={<Link to="/quiz/join" className="btn-primary"><KeyRound className="h-4 w-4" /> Join with a code</Link>}>
          Register for a test from an organiser in Quizzes, or enter a code someone shared with you.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {data.map((a) => (
            <li key={a._id}>
              <Link
                to={a.status === 'in_progress' ? `/quiz/attempt/${a._id}` : `/quiz/attempt/${a._id}/result`}
                className="flex flex-col gap-1 px-4 py-3.5 hover:bg-surface-2 sm:flex-row sm:items-center sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-editorial text-[17px] font-medium text-ink">{a.quiz?.title ?? 'Removed test'}</span>
                    <StatusChip status={a.status} />
                  </span>
                  <span className="muted block text-[13px]">
                    {a.quiz?.organizer?.name ? `by ${a.quiz.organizer.name} · ` : ''}
                    {fmtDateTime(a.startedAt)}
                    {a.attemptNumber > 1 ? ` · attempt ${a.attemptNumber}` : ''}
                  </span>
                </span>
                <span className="text-[14px]">
                  {a.released && a.status !== 'in_progress' ? (
                    <span className={cn('ds-num font-semibold', a.status === 'disqualified' ? 'text-danger' : 'text-ink')}>
                      {a.score} / {a.maxScore} {a.rank ? <span className="muted font-normal">· rank {a.rank}</span> : null}
                      {a.timeTakenSec ? <span className="muted font-normal"> · {fmtDuration(a.timeTakenSec)}</span> : null}
                    </span>
                  ) : a.status === 'in_progress' ? (
                    <span className="text-ds-brand-text">Continue</span>
                  ) : (
                    <span className="muted">Results {a.quiz?.endTime ? `after ${fmtDateTime(a.quiz.endTime)}` : 'later'}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Tests: Quizzes (organisers) · My attempts · Hosting (my own tests, for approved hosts). */
export default function QuizHome() {
  const [params, setParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [applyOpen, setApplyOpen] = useState(false);
  // an admin may have decided the application since this page loaded the account
  const hostStatus = useHostStatus();
  const latest = hostStatus.data?.status;
  useEffect(() => {
    if (latest && user && !user.isAdmin && latest !== user.quizHost) setUser({ ...user, quizHost: latest });
  }, [latest, user, setUser]);
  const host = canHostTests(user);
  const mine = useMyQuizzes();
  // tests made before hosting needed approval stay manageable
  const showHosting = host || mine.data?.length > 0;
  const requested = params.get('tab');
  const tab = requested === 'attempts' ? 'attempts' : requested === 'hosting' && showHosting ? 'hosting' : 'quizzes';
  const tabs = [
    ['quizzes', 'Quizzes'],
    ['attempts', 'My attempts'],
    ...(showHosting ? [['hosting', 'Hosting']] : []),
  ];
  return (
    <PageShell
      title="Tests"
      subtitle="Timed, proctored tests from approved organisers"
      actions={
        <div className="flex gap-2">
          <Link to="/quiz/join" className="btn-secondary min-h-9 whitespace-nowrap px-3 text-[14px]" title="Join with a code"><KeyRound className="h-4 w-4" /> <span className="hidden sm:inline">Join</span></Link>
          {host ? (
            <Link to="/quiz/create" className="btn-primary min-h-9 whitespace-nowrap px-3 text-[14px]"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create</span></Link>
          ) : user?.quizHost === 'pending' ? (
            <span className="btn-ghost pointer-events-none min-h-9 whitespace-nowrap px-3 text-[13px] text-warning" title="Your application to host quizzes is waiting for Tectum's approval"><Hourglass className="h-4 w-4" /> <span className="hidden sm:inline">Pending</span></span>
          ) : (
            <button className="btn-primary min-h-9 whitespace-nowrap px-3 text-[14px]" onClick={() => setApplyOpen(true)}><Building2 className="h-4 w-4" /> <span className="hidden sm:inline">Host quizzes</span></button>
          )}
        </div>
      }
      tabs={
        <div className="flex border-t border-line px-2" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={cn('tab', tab === id && 'tab-active')} onClick={() => setParams(id === 'quizzes' ? {} : { tab: id }, { replace: true })}>
              {label}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'quizzes' ? <Organisations onApply={() => setApplyOpen(true)} /> : tab === 'attempts' ? <MyAttempts /> : <MyTests />}
      {applyOpen && <ApplyToHostModal open onClose={() => setApplyOpen(false)} />}
    </PageShell>
  );
}
