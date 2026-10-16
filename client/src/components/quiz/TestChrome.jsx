import { AlertTriangle, Ban, Clock, Maximize, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/format';
import { fmtCountdown, fmtClock } from '../../lib/quiz';

/**
 * Pieces of the full-screen test screen: the timer, the question palette, the "return to full
 * screen" warning and the disqualified screen.
 */

/** Countdown, red in the last 5 minutes; announced to screen readers at 5 and 1 minutes. */
export function Timer({ msLeft }) {
  const known = msLeft != null;
  const low = known && msLeft <= 5 * 60_000;
  const crit = known && msLeft <= 60_000;
  return (
    <div
      className={cn('ds-num flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[17px] font-semibold tabular-nums', crit ? 'animate-pulse border-danger bg-danger-soft text-danger' : low ? 'border-danger/60 text-danger' : 'border-line text-ink')}
      role="timer"
      aria-label={known ? `Time left ${fmtCountdown(msLeft)}` : 'Time left: loading'}
    >
      <Clock className="h-4 w-4" aria-hidden="true" />
      {known ? fmtCountdown(msLeft) : '--:--'}
    </div>
  );
}

/**
 * Jump to any question. Colours (with a legend, and words for screen readers):
 * answered = filled blue, marked for review = amber ring, current = thick outline, not answered = plain.
 */
export function QuestionPalette({ questions, answers, current, onJump }) {
  const counts = { answered: 0, marked: 0, notAnswered: 0 };
  questions.forEach((q) => {
    const a = answers[q._id];
    if (a?.selected?.length) counts.answered += 1;
    else counts.notAnswered += 1;
    if (a?.markedForReview) counts.marked += 1;
  });
  return (
    <nav aria-label="Questions" className="space-y-3">
      <div className="grid max-h-[50vh] grid-cols-6 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((q, i) => {
          const a = answers[q._id];
          const answered = a?.selected?.length > 0;
          const marked = a?.markedForReview;
          const label = `Question ${i + 1}: ${answered ? 'answered' : 'not answered'}${marked ? ', marked for review' : ''}${i === current ? ', current' : ''}`;
          return (
            <button
              key={q._id}
              type="button"
              onClick={() => onJump(i)}
              aria-label={label}
              aria-current={i === current ? 'step' : undefined}
              className={cn(
                'ds-num relative h-10 rounded-[8px] border text-[13px] font-semibold transition-colors',
                answered ? 'border-ds-brand bg-ds-brand text-ds-on-brand' : 'border-line bg-surface text-ds-fg-2 hover:bg-surface-2',
                marked && 'ring-2 ring-warning ring-offset-1 ring-offset-[var(--ds-surface)]',
                i === current && 'outline-2 outline-offset-2 outline-ink'
              )}
            >
              {i + 1}
              {marked && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-warning" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <ul className="muted grid grid-cols-2 gap-1 text-[12px]">
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-ds-brand" /> Answered ({counts.answered})</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] border border-line" /> Not answered ({counts.notAnswered})</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] ring-2 ring-warning" /> For review ({counts.marked})</li>
      </ul>
    </nav>
  );
}

/**
 * Covers the test when full screen was left but the organizer allows another chance.
 * `phone`: iPhone mode (no full screen on iPhones) - they left the page instead; Continue resumes.
 */
export function ProctorWarningModal({ used, allowed, kind, onReturn, busy, phone = false }) {
  const left = allowed - used;
  // used = 0: full screen was just left and the server hasn't answered yet
  const pending = !used;
  if (phone) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--ds-bg)] p-6" role="alertdialog" aria-modal="true" aria-labelledby="proctor-warn">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft text-warning">
            <AlertTriangle className="h-7 w-7" />
          </span>
          <h2 id="proctor-warn" className="font-editorial text-[24px] font-medium">{pending ? 'You left the test' : `Warning ${used} of ${allowed}`}</h2>
          <p className="mt-2 text-[15px] leading-6 text-ds-fg-2">
            You left the test page (another app, tab or the home screen). Stay on this page until you submit.{' '}
            {pending ? '' : left > 0 ? `You have ${left} more warning${left === 1 ? '' : 's'} left.` : 'One more and you will be disqualified.'}
          </p>
          <p className="muted mt-1 text-[13px]">The timer is still running.</p>
          <button className="btn-primary mt-6 w-full" onClick={onReturn} disabled={busy} autoFocus>
            Continue the test
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--ds-bg)] p-6" role="alertdialog" aria-modal="true" aria-labelledby="proctor-warn">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h2 id="proctor-warn" className="font-editorial text-[24px] font-medium">
          {pending ? 'Return to full screen' : `Warning ${used} of ${allowed}`}
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-ds-fg-2">
          {kind === 'tab' ? 'You switched away from the test.' : 'You left full-screen mode.'} Return to full screen now to continue.{' '}
          {pending ? '' : left > 0 ? `You have ${left} more warning${left === 1 ? '' : 's'} left.` : 'One more and you will be disqualified.'}
        </p>
        <p className="muted mt-1 text-[13px]">The timer is still running.</p>
        <button className="btn-primary mt-6 w-full" onClick={onReturn} disabled={busy} autoFocus>
          <Maximize className="h-4 w-4" /> Return to full screen
        </button>
      </div>
    </div>
  );
}

/** The end: shown when the server disqualified the attempt. No way back into the test. */
export function DisqualifiedScreen({ at, reason, onDone }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--ds-bg)] p-6" role="alert">
      <div className="w-full max-w-lg rounded-[20px] border border-danger/30 bg-surface p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <Ban className="h-7 w-7" />
        </span>
        <h1 className="font-editorial text-[26px] font-medium">You have been disqualified</h1>
        <p className="mt-3 text-[15px] leading-6 text-ds-fg-2">
          {reason ? reason.replace(/^Disqualified: /, 'You ') : 'You broke a test rule'}
          {at && !reason ? ` at ${fmtClock(at)}` : ''}. Your responses up to this point were submitted.
        </p>
        <p className="muted mt-2 flex items-start justify-center gap-1.5 text-[13px]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> The organizer can see what happened and can reinstate you if it was a genuine mistake.
        </p>
        <button className="btn-secondary mt-6" onClick={onDone}>
          Go to my results
        </button>
      </div>
    </div>
  );
}
