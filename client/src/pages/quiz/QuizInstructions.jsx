import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Ban, CalendarClock, Clock, FileQuestion, Hourglass, Laptop, Maximize, MinusCircle, Play, Repeat } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PageShell } from '../../components/Layout';
import { ErrorState, PageLoader, Spinner } from '../../components/ui';
import Avatar from '../../components/Avatar';
import { startAttempt, useQuizInfo } from '../../hooks/useQuiz';
import { useCountdown } from '../../hooks/useCountdown';
import { FULLSCREEN_REQUIRED, enterFullscreen, exitFullscreen, fmtCountdown, fmtDateTime, fullscreenElement, fullscreenSupported, isMobileDevice, isPhoneMode, plural, writeSession } from '../../lib/quiz';

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-line px-4 py-3">
      <Icon className="h-5 w-5 shrink-0 text-ds-fg-3" />
      <div>
        <p className="ds-eyebrow">{label}</p>
        <p className="text-[15px] font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}

/** The mandatory warning, word for word from the rules. */
function RulesWarning({ allowedExits, allowedSwitches }) {
  const strict = !allowedExits && !allowedSwitches;
  return (
    <section className="rounded-[14px] border-2 border-warning/60 bg-warning-soft px-5 py-4" aria-labelledby="rules-title">
      <h2 id="rules-title" className="flex items-center gap-2 text-[17px] font-semibold text-ink">
        <AlertTriangle className="h-5 w-5 text-warning" /> Important – Read before starting
      </h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-6 text-ink">
        <li>This test runs in full-screen mode. It will start only after you enter full screen.</li>
        <li>
          If you exit full screen (including pressing <kbd className="rounded border border-line bg-surface px-1 text-[13px]">Esc</kbd>), switch tabs, minimize the window or switch to another app,{' '}
          {strict ? (
            <strong>you will be disqualified immediately and your test will be submitted automatically.</strong>
          ) : (
            <strong>
              you get a warning ({allowedExits ? plural(allowedExits, 'full-screen exit') : 'no full-screen exits'} and {allowedSwitches ? plural(allowedSwitches, 'tab switch', 'tab switches') : 'no tab switches'} allowed); after that you will be disqualified and your test submitted automatically.
            </strong>
          )}
        </li>
        <li>Copy, paste, right-click, printing and screenshot shortcuts are disabled.</li>
        <li>Do not refresh or close the page - that counts as leaving full screen. Make sure you have a stable internet connection and enough battery.</li>
        <li>Your timer starts as soon as you click Start Test and cannot be paused.</li>
        <li>All your activity during the test is logged and visible to the organizer.</li>
      </ul>
    </section>
  );
}

/**
 * The rules without full screen (iPhone mode, or everyone while FULLSCREEN_REQUIRED is off):
 * leaving the page is what counts.
 */
function PhoneRulesWarning({ allowedSwitches }) {
  return (
    <section className="rounded-[14px] border-2 border-warning/60 bg-warning-soft px-5 py-4" aria-labelledby="rules-title">
      <h2 id="rules-title" className="flex items-center gap-2 text-[17px] font-semibold text-ink">
        <AlertTriangle className="h-5 w-5 text-warning" /> {FULLSCREEN_REQUIRED ? 'Important – iPhone / iPad mode' : 'Important – Read before starting'}
      </h2>
      {FULLSCREEN_REQUIRED && <p className="mt-1 text-[14px] text-ds-fg-2">This device's browser doesn't allow websites to go full screen, so the test fills the page instead.</p>}
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-6 text-ink">
        <li>
          Stay on this page until you submit. If you switch tabs, minimise the window, open another app or window, go to the home screen or lock your device,{' '}
          {allowedSwitches ? (
            <strong>you get a warning ({plural(allowedSwitches, 'time')} allowed); after that you will be disqualified and your test submitted automatically.</strong>
          ) : (
            <strong>you will be disqualified immediately and your test will be submitted automatically.</strong>
          )}
        </li>
        <li>Turn on Do Not Disturb first, so a call or notification doesn't pull you away. Keep your device charged and connected.</li>
        <li>Copy, paste, right-click, text selection, printing and screenshot shortcuts are disabled. Do not reload or close the page - that counts as leaving it.</li>
        <li>Your timer starts as soon as you start the test and cannot be paused.</li>
        <li>{FULLSCREEN_REQUIRED ? 'All your activity is logged, and the organizer sees that you took the test in iPhone / iPad mode.' : 'All your activity during the test is logged and visible to the organizer.'}</li>
      </ul>
    </section>
  );
}

/**
 * Before the test: the details, the organizer's instructions, the rules, an "I agree" box and
 * Start. Start enters full screen in the same click (browsers only allow it from a click), and
 * only once full screen is confirmed does it ask the server to start the attempt.
 */
export default function QuizInstructions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isPending, isError, error, refetch } = useQuizInfo(id);
  const [agree, setAgree] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const elig = data?.eligibility;
  const msToStart = useCountdown(elig?.state === 'not_started' ? elig.startsAt : null, data?.serverNow);

  // the test opens while this page is open: check again
  useEffect(() => {
    if (elig?.state === 'not_started' && msToStart === 0) refetch();
  }, [elig?.state, msToStart, refetch]);

  if (isPending) return <PageShell title="Test"><PageLoader /></PageShell>;
  if (isError) {
    return (
      <PageShell title="Test">
        {error?.response?.status === 403 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[15px]">{error.message}</p>
            {/register/i.test(error.message) ? (
              <Link to={`/quiz/${id}/details`} className="btn-primary mt-4">Go to the test's page</Link>
            ) : (
              <Link to="/quiz/join" className="btn-primary mt-4">Enter the code</Link>
            )}
          </div>
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </PageShell>
    );
  }

  const quiz = data.quiz;
  const s = quiz.settings;
  // iPhones: no full screen for web pages - the test runs in iPhone mode instead
  const phone = isPhoneMode();
  const noFullscreen = !fullscreenSupported() && !phone;
  const mobileBlocked = s.desktopOnly && isMobileDevice();

  const start = async () => {
    setStartError('');
    setStarting(true);
    if (!phone) {
      try {
        // 1. full screen first, inside this click
        await enterFullscreen();
        await new Promise((r) => setTimeout(r, 150));
        if (!fullscreenElement()) throw new Error('fullscreen');
      } catch {
        setStarting(false);
        setStartError('Full screen was not allowed, so the test did not start. Allow full screen and press Start Test again.');
        return;
      }
    }
    try {
      // 2. only now: create the attempt on the server
      const res = await startAttempt(id, phone ? 'phone' : 'fullscreen');
      writeSession(res.attempt._id, res.sessionToken);
      qc.setQueryData(['attempt', res.attempt._id, 'start'], res);
      navigate(`/quiz/attempt/${res.attempt._id}`, { replace: true });
    } catch (e) {
      exitFullscreen();
      setStartError(e.message);
      setStarting(false);
      refetch();
    }
  };

  return (
    <PageShell title={quiz.title} docTitle={`Instructions · ${quiz.title}`} subtitle={quiz.category || 'Test'}>
      <div className="space-y-5 px-4 py-5 sm:px-6">
        {quiz.organizer?.name && (
          <div className="flex items-center gap-2 text-[14px] text-ds-fg-2">
            <Avatar user={quiz.organizer} size="xs" /> Organised by <span className="font-medium text-ink">{quiz.organizer.name}</span>
          </div>
        )}
        {quiz.description && <p className="whitespace-pre-wrap text-[15px] leading-6 text-ds-fg-2">{quiz.description}</p>}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Fact icon={FileQuestion} label="Questions" value={`${quiz.questionCount} · ${quiz.totalMarks} marks`} />
          <Fact icon={Clock} label="Duration" value={plural(quiz.durationMinutes, 'minute')} />
          <Fact icon={MinusCircle} label="Negative marking" value={quiz.negativeMarking ? 'Yes - wrong answers lose marks' : 'No'} />
          <Fact icon={Repeat} label="Attempts" value={`${elig.attemptsLeft || 0} of ${s.maxAttempts} left`} />
          <Fact icon={CalendarClock} label="Open" value={`${fmtDateTime(quiz.startTime)} – ${fmtDateTime(quiz.endTime)}`} />
          <Fact icon={Hourglass} label="Results" value={s.resultVisibility === 'immediate' ? 'Right after you submit' : 'After the test closes'} />
        </div>
        {s.perQuestionTimer && <p className="muted text-[13px]">Some questions have their own time limit; their answers lock when it runs out.</p>}

        {quiz.instructions && (
          <section aria-labelledby="org-ins">
            <h2 id="org-ins" className="mb-1.5 font-editorial text-[20px] font-medium">Instructions from the organizer</h2>
            <p className="whitespace-pre-wrap rounded-[12px] border border-line px-4 py-3 text-[15px] leading-6 text-ink">{quiz.instructions}</p>
          </section>
        )}

        {phone ? <PhoneRulesWarning allowedSwitches={s.allowedTabSwitches} /> : <RulesWarning allowedExits={s.allowedFullscreenExits} allowedSwitches={s.allowedTabSwitches} />}

        {elig.state === 'blocked' ? (
          <p className="flex items-start gap-2 rounded-[12px] bg-danger-soft px-4 py-3 text-[15px] text-ink" role="alert">
            <Ban className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <span>
              {elig.reason}
              {elig.needsRegistration && <Link to={`/quiz/${id}/details`} className="mt-1 block font-medium text-link hover:underline">Open the test's page to register</Link>}
            </span>
          </p>
        ) : noFullscreen || mobileBlocked ? (
          <p className="flex items-start gap-2 rounded-[12px] bg-danger-soft px-4 py-3 text-[15px] text-ink" role="alert">
            <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            {mobileBlocked ? 'This test can only be taken on a desktop or laptop computer.' : 'This test must be taken on a desktop/laptop or an Android device with Chrome (this browser does not support full screen).'}
          </p>
        ) : elig.state === 'not_started' ? (
          <div className="rounded-[12px] border border-line px-4 py-4 text-center" role="timer" aria-live="off">
            <p className="ds-eyebrow">The test opens in</p>
            <p className="ds-num font-mono text-[34px] font-semibold text-ink">{fmtCountdown(msToStart ?? 0)}</p>
            <p className="muted text-[13px]">at {fmtDateTime(elig.startsAt)} · keep this page open, it will be ready then</p>
          </div>
        ) : elig.state === 'in_progress' ? (
          <div className="space-y-3">
            <p className="text-[15px] text-ink">
              {phone ? 'You have this test in progress. Closing the page earlier counts as leaving it, under the rules above.' : 'You have this test in progress. Continuing reopens it in full screen; closing the page earlier counts as leaving full screen, under the rules above.'}
            </p>
            <button className="btn-primary" onClick={async () => { if (!phone) await enterFullscreen().catch(() => {}); navigate(`/quiz/attempt/${elig.attemptId}`); }}>
              {phone ? <Play className="h-4 w-4" /> : <Maximize className="h-4 w-4" />} Continue the test
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 text-[15px] text-ink">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--ds-brand)]" />
              I have read and agree to the rules above.
            </label>
            <button className="btn-primary w-full sm:w-auto" disabled={!agree || starting} onClick={start}>
              {starting ? <Spinner className="h-4 w-4" /> : phone ? <Play className="h-4 w-4" /> : <Maximize className="h-4 w-4" />} Start Test
            </button>
          </div>
        )}
        {startError && <p className="text-[14px] text-danger" role="alert">{startError}</p>}
      </div>
    </PageShell>
  );
}
