import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarClock, CheckCircle2, Clock, FileQuestion, Hourglass, Play, Radio, Trophy, UserPlus, XCircle } from 'lucide-react';
import { EmptyState, ErrorState, Modal, PageLoader } from '../ui';
import { useHostTests, useRegister } from '../../hooks/useQuiz';
import { useAuthStore } from '../../store/auth';
import { toast } from '../../store/ui';
import { fmtDateTime, plural } from '../../lib/quiz';
import { cn } from '../../lib/format';
import { StatusChip } from './QuizBits';

/** "Register" for a listed test: the details the organizer sees (name, college), prefilled from the profile. */
export function RegisterModal({ quiz, open, onClose }) {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState(user?.name ?? '');
  const [college, setCollege] = useState(user?.institution ?? '');
  const [error, setError] = useState('');
  const register = useRegister(quiz._id);
  const send = () => {
    if (name.trim().length < 2) return setError('Enter your full name');
    if (college.trim().length < 2) return setError('Enter your college or institution');
    register.mutate(
      { name: name.trim(), college: college.trim() },
      {
        onSuccess: (d) => {
          toast(d.message);
          onClose();
        },
        onError: (e) => setError(e.message),
      }
    );
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Register for ${quiz.title}`}
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={send} disabled={register.isPending}>{register.isPending ? 'Sending…' : 'Send request'}</button>
        </div>
      }
    >
      <form
        className="space-y-3 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <p className="text-[14px] text-ds-fg-2">The organizer reviews each request. Once they accept yours, a Start Test button appears here when the test goes live.</p>
        <div>
          <label className="label" htmlFor="reg-name">Name</label>
          <input id="reg-name" className="input" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="reg-college">College name</label>
          <input id="reg-college" className="input" autoComplete="organization" maxLength={150} value={college} onChange={(e) => setCollege(e.target.value)} placeholder="e.g. Grant Government Medical College, Mumbai" />
        </div>
        {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/**
 * The one button for a listed test, by where the member stands:
 * Register -> Pending request -> (accepted) Registered · opens … -> Start Test when live -> View result.
 */
export function TestAction({ quiz, isOrganizer, size = 'md' }) {
  const [open, setOpen] = useState(false);
  const reg = quiz.registration?.status;
  const attempt = quiz.myAttempt;
  const small = size === 'sm' ? 'min-h-9 px-3 text-[13px]' : '';
  if (isOrganizer) {
    return <Link to={`/quiz/${quiz._id}/manage`} className={cn('btn-secondary', small)}><BarChart3 className="h-4 w-4" /> Manage</Link>;
  }
  if (attempt?.status === 'in_progress') {
    return <Link to={`/quiz/${quiz._id}/instructions`} className={cn('btn-primary', small)}><Play className="h-4 w-4" /> Continue test</Link>;
  }
  if (attempt) {
    return <Link to={`/quiz/attempt/${attempt._id}/result`} className={cn('btn-secondary', small)}><Trophy className="h-4 w-4" /> View result</Link>;
  }
  if (quiz.phase === 'ended') {
    return <Link to={`/quiz/${quiz._id}/details`} className={cn('btn-secondary', small)}><Trophy className="h-4 w-4" /> Leaderboard</Link>;
  }
  if (reg === 'accepted') {
    return quiz.phase === 'live' ? (
      <Link to={`/quiz/${quiz._id}/instructions`} className={cn('btn-primary', small)}><Play className="h-4 w-4" /> Start Test</Link>
    ) : (
      <span className={cn('btn-secondary pointer-events-none border-success/40 text-success', small)}><CheckCircle2 className="h-4 w-4" /> Registered</span>
    );
  }
  if (reg === 'pending') {
    return <span className={cn('btn-secondary pointer-events-none text-warning', small)} title="Waiting for the organizer to accept"><Hourglass className="h-4 w-4" /> Pending Request</span>;
  }
  if (reg === 'rejected') {
    return <span className={cn('btn-ghost pointer-events-none text-ds-fg-3', small)}><XCircle className="h-4 w-4" /> Not accepted</span>;
  }
  if (!quiz.isJoinable) return <span className={cn('btn-ghost pointer-events-none text-ds-fg-3', small)}>Registrations closed</span>;
  return (
    <>
      <button className={cn('btn-primary', small)} onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Register</button>
      {open && <RegisterModal quiz={quiz} open onClose={() => setOpen(false)} />}
    </>
  );
}

/** One test in a host's list. Live tests get the highlighted card. */
function TestRow({ quiz, isOrganizer }) {
  const live = quiz.phase === 'live';
  return (
    <li className={cn('px-4 py-4 sm:px-5', live && 'border-l-4 border-l-success bg-success-soft/40')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link to={`/quiz/${quiz._id}/details`} className="min-w-0 flex-1 rounded-[8px] focus-visible:outline-2 focus-visible:outline-link">
          <div className="flex flex-wrap items-center gap-2">
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                <Radio className="h-3 w-3" /> Live now
              </span>
            )}
            <h3 className="truncate font-editorial text-[18px] font-medium leading-6 text-ink hover:underline">{quiz.title}</h3>
            {!live && <StatusChip phase={quiz.phase} />}
          </div>
          {quiz.description && <p className="mt-0.5 line-clamp-2 text-[14px] text-ds-fg-2">{quiz.description}</p>}
          <p className="muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" /> {live ? `closes ${fmtDateTime(quiz.endTime)}` : quiz.phase === 'ended' ? fmtDateTime(quiz.startTime) : `opens ${fmtDateTime(quiz.startTime)}`}
            </span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {quiz.durationMinutes} min</span>
            <span className="inline-flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {plural(quiz.questionCount, 'question')} · {quiz.totalMarks} marks</span>
            {quiz.category && <span>{quiz.category}</span>}
          </p>
        </Link>
        <div className="shrink-0">
          <TestAction quiz={quiz} isOrganizer={isOrganizer} size="sm" />
        </div>
      </div>
    </li>
  );
}

/**
 * A host's tests (profile Tests tab, and the organisation's directory from Tests → Quizzes):
 * Upcoming - live tests pinned at the top, then scheduled ones by date; Past - newest first, each
 * opening its page with the leaderboard.
 */
export default function HostTests({ userId, name }) {
  const [view, setView] = useState('upcoming');
  const { data, isPending, isError, error, refetch } = useHostTests(userId);
  if (isPending) return <PageLoader count={2} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const list = view === 'upcoming' ? data.upcoming : data.past;
  const live = data.upcoming.filter((q) => q.phase === 'live').length;
  return (
    <div>
      <div className="px-3 py-3">
        <div role="tablist" aria-label="Tests" className="segmented">
          {[
            ['upcoming', `Upcoming${data.upcoming.length ? ` (${data.upcoming.length})` : ''}`],
            ['past', `Past${data.past.length ? ` (${data.past.length})` : ''}`],
          ].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn('segment inline-flex flex-1 items-center justify-center gap-1.5', view === id && 'segment-active')}>
              {id === 'upcoming' && live > 0 && <span className="h-2 w-2 rounded-full bg-success" aria-label={`${live} live`} />}
              {label}
            </button>
          ))}
        </div>
      </div>
      {!list.length ? (
        <EmptyState icon={view === 'upcoming' ? CalendarClock : Trophy} title={view === 'upcoming' ? 'No upcoming tests' : 'No past tests yet'}>
          {view === 'upcoming'
            ? data.isSelf
              ? 'Publish a test with "Show on my profile" switched on and it appears here for students to register.'
              : `When ${name ?? 'this organiser'} schedules a test, it shows up here.`
            : 'Finished tests and their leaderboards appear here.'}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {list.map((q) => <TestRow key={q._id} quiz={q} isOrganizer={data.isSelf} />)}
        </ul>
      )}
    </div>
  );
}
