import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Clock, FileQuestion, Hourglass, Laptop, MinusCircle, Repeat, Trophy, Users } from 'lucide-react';
import { PageShell } from '../../components/Layout';
import { ErrorState, PageLoader } from '../../components/ui';
import Avatar from '../../components/Avatar';
import Leaderboard from '../../components/quiz/Leaderboard';
import { StatusChip } from '../../components/quiz/QuizBits';
import { TestAction } from '../../components/quiz/HostTests';
import { useQuizDetails, useRegister } from '../../hooks/useQuiz';
import { FULLSCREEN_REQUIRED, fmtDateTime, plural } from '../../lib/quiz';
import { toast } from '../../store/ui';
import NotFoundState from '../../components/NotFoundState';

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-line px-4 py-3">
      <Icon className="h-5 w-5 shrink-0 text-ds-fg-3" />
      <div className="min-w-0">
        <p className="ds-eyebrow">{label}</p>
        <p className="text-[15px] font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}

/** What the member's registration means right now, in one line. */
function RegistrationNote({ quiz }) {
  const withdraw = useRegister(quiz._id);
  const status = quiz.registration?.status;
  if (!status || quiz.myAttempt || quiz.phase === 'ended') return null;
  const text = {
    pending: 'Your request is waiting for the organizer. You will get a notification when they accept it.',
    accepted: quiz.phase === 'live' ? "You're registered and the test is live. Start it when you're ready." : `You're registered. Come back when it opens (${fmtDateTime(quiz.startTime)}); the Start Test button appears here.`,
    rejected: 'The organizer did not accept your request for this test.',
  }[status];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-line px-4 py-3 text-[14px] text-ds-fg-2">
      <span className="flex-1">
        {text}
        {quiz.registration?.college && <span className="muted block text-[13px]">Registered as {quiz.registration.name} · {quiz.registration.college}</span>}
      </span>
      {status !== 'rejected' && (
        <button
          className="text-[13px] font-medium text-danger hover:underline"
          disabled={withdraw.isPending}
          onClick={() => window.confirm('Withdraw your registration for this test?') && withdraw.mutate(null, { onSuccess: (d) => toast(d.message), onError: (e) => toast(e.message, 'error') })}
        >
          Withdraw
        </button>
      )}
    </div>
  );
}

/**
 * A listed test's page (/quiz/:id/details): what it is, when, the rules in brief, and the one action
 * (Register / Pending Request / Start Test / View result). Once it's over: the leaderboard.
 */
export default function QuizDetails() {
  const { id } = useParams();
  const { data, isPending, isError, error, refetch } = useQuizDetails(id);
  if (isPending) return <PageShell title="Test"><PageLoader /></PageShell>;
  if (isError) {
    return (
      <PageShell title="Test">
        {error.response?.status === 404 ? <NotFoundState title="This test isn't available">It may have been removed, or it's a private test that needs a code.</NotFoundState> : <ErrorState error={error} onRetry={refetch} />}
      </PageShell>
    );
  }
  const quiz = data.quiz;
  const s = quiz.settings;
  const org = quiz.organizer;
  const ended = quiz.phase === 'ended';
  return (
    <PageShell
      title={quiz.title}
      docTitle={quiz.title}
      subtitle={quiz.category || 'Test'}
      actions={org?._id && <Link to={`/profile/${org._id}?tab=tests`} className="btn-ghost min-h-9 px-3 text-[14px]"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">All tests</span></Link>}
    >
      <div className="space-y-5 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          {org?._id && (
            <Link to={`/profile/${org._id}?tab=tests`} className="flex items-center gap-2 text-[14px] text-ds-fg-2 hover:underline">
              <Avatar user={org} size="xs" /> By <span className="font-medium text-ink">{org.name}</span>
            </Link>
          )}
          <StatusChip phase={quiz.phase} />
          <div className="ml-auto">
            <TestAction quiz={quiz} isOrganizer={data.isOrganizer} />
          </div>
        </div>
        {quiz.description && <p className="whitespace-pre-wrap text-[15px] leading-6 text-ds-fg-2">{quiz.description}</p>}
        <RegistrationNote quiz={quiz} />

        <div className="grid gap-2.5 sm:grid-cols-2">
          <Fact icon={CalendarClock} label={ended ? 'Was open' : 'Open'} value={`${fmtDateTime(quiz.startTime)} – ${fmtDateTime(quiz.endTime)}`} />
          <Fact icon={Clock} label="Duration" value={plural(quiz.durationMinutes, 'minute')} />
          <Fact icon={FileQuestion} label="Questions" value={`${quiz.questionCount} · ${quiz.totalMarks} marks`} />
          <Fact icon={MinusCircle} label="Negative marking" value={quiz.negativeMarking ? 'Yes' : 'No'} />
          <Fact icon={Repeat} label="Attempts" value={plural(s.maxAttempts ?? 1, 'attempt')} />
          <Fact icon={Hourglass} label="Results" value={s.resultVisibility === 'immediate' ? 'Right after you submit' : 'After the test closes'} />
          {s.desktopOnly && <Fact icon={Laptop} label="Device" value="Desktop or laptop only" />}
          {!ended && <Fact icon={Users} label="Registered" value={quiz.maxParticipants ? `${quiz.accepted} of ${quiz.maxParticipants} places` : plural(quiz.accepted, 'participant')} />}
        </div>
        {!ended && (
          <p className="muted text-[13px]">
            {FULLSCREEN_REQUIRED
              ? `Proctored: the test runs in full screen. Leaving full screen or switching tabs ${s.allowedFullscreenExits || s.allowedTabSwitches ? 'after the allowed warnings ' : ''}disqualifies you. On iPhones and iPads without full screen it runs in iPhone / iPad mode: leaving the test page counts instead.`
              : `Proctored: leaving the test page (switching tabs, windows or apps) ${s.allowedTabSwitches ? 'after the allowed warnings ' : ''}disqualifies you. Copy, paste and right-click are disabled.`}
          </p>
        )}

        {ended && (
          <section aria-labelledby="board-title" className="rounded-[14px] border border-line">
            <h2 id="board-title" className="flex items-center gap-2 border-b border-line px-4 py-3 font-editorial text-[20px] font-medium">
              <Trophy className="h-5 w-5 text-ds-accent-text" /> Leaderboard
              {quiz.participants != null && <span className="muted ml-auto font-sans text-[13px] font-normal">{plural(quiz.participants, 'participant')}</span>}
            </h2>
            {data.leaderboard ? <Leaderboard rows={data.leaderboard} /> : <p className="muted px-4 py-6 text-center text-[14px]">The organizer has not made the leaderboard public.</p>}
          </section>
        )}
      </div>
    </PageShell>
  );
}
