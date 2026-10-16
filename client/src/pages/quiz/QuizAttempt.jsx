import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, CheckCircle2, CloudOff, Eraser, LayoutGrid, Loader2, Send, X } from 'lucide-react';
import { Modal } from '../../components/ui';
import QuestionView from '../../components/quiz/QuestionView';
import { DisqualifiedScreen, ProctorWarningModal, QuestionPalette, Timer } from '../../components/quiz/TestChrome';
import { attemptApi } from '../../hooks/useQuiz';
import { useAutosave } from '../../hooks/useAutosave';
import { useCountdown } from '../../hooks/useCountdown';
import { useProctoring } from '../../hooks/useProctoring';
import { enterFullscreen, exitFullscreen, fullscreenElement, isPhoneMode, writeSession } from '../../lib/quiz';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cn } from '../../lib/format';

const HEARTBEAT_MS = 10_000;

/**
 * The test, full screen, nothing else on the page (no menus, links or chat). The server decides
 * everything that matters: time left (expiresAt), whether a violation disqualifies, the score.
 */
export default function QuizAttempt() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const api = useMemo(() => attemptApi(attemptId), [attemptId]);

  const [phase, setPhase] = useState('loading'); // loading | running | blocked | disqualified | error
  const [message, setMessage] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);
  const [serverNow, setServerNow] = useState(null);
  const [answers, setAnswers] = useState({}); // questionId -> { selected, markedForReview, firstSeenAt }
  const [current, setCurrent] = useState(0);
  const [warning, setWarning] = useState(null);
  const [dq, setDq] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [tick, setTick] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);

  const endingRef = useRef(false);
  const pendingViolations = useRef([]); // couldn't be sent (offline): sent again later
  const timeSpent = useRef({});
  const viewStart = useRef(Date.now());
  const localSeen = useRef({});

  useDocumentTitle(quiz ? `Test · ${quiz.title}` : 'Test');

  const toResult = useCallback(() => navigate(`/quiz/attempt/${attemptId}/result`, { replace: true }), [navigate, attemptId]);

  /** The attempt ended on the server (submitted elsewhere, time up, disqualified). */
  const ended = useCallback(
    (status, info = {}) => {
      endingRef.current = true;
      exitFullscreen();
      if (status === 'disqualified') {
        setDq({ at: info.disqualifiedAt, reason: info.disqualifiedReason });
        setPhase('disqualified');
      } else toResult();
    },
    [toResult]
  );

  const autosave = useAutosave(api.save, { onEnded: (status) => ended(status) });

  // ---- violations: reported to the server, which decides ----
  const sendViolation = useCallback(
    async (type, meta) => {
      try {
        const r = await api.violation(type, meta);
        if (r.status === 'disqualified' || (r.status && r.status !== 'in_progress')) return ended(r.status, r);
        if (r.warning) setWarning(r.warning);
      } catch (e) {
        if (!e.response) pendingViolations.current.push({ type, meta: `${meta} (sent late: offline)` });
      }
    },
    [api, ended]
  );
  const onViolation = useCallback((type, meta) => !endingRef.current && sendViolation(type, meta), [sendViolation]);
  // iPhone mode: no full screen exists there, so leaving the page is what's watched (useProctoring)
  const [phone] = useState(isPhoneMode);
  const { isFullscreen } = useProctoring({ active: phase === 'running', onViolation, phone });

  // ---- load (straight from Start, or reopened) ----
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const fromStart = qc.getQueryData(['attempt', attemptId, 'start']);
        // dropped a moment later, not now: a second run of this effect (React re-mounting it)
        // must still know the test was just started here, not reloaded
        setTimeout(() => qc.removeQueries({ queryKey: ['attempt', attemptId, 'start'] }), 2000);
        const res = fromStart ?? (await api.load());
        if (!live) return;
        if (res.sessionToken) writeSession(attemptId, res.sessionToken);
        setQuiz(res.quiz);
        setServerNow(res.attempt.serverNow);
        setExpiresAt(res.attempt.expiresAt);
        if (res.attempt.status === 'disqualified') return ended('disqualified', res.attempt);
        if (res.attempt.status !== 'in_progress') return toResult();
        setQuestions(res.questions);
        setAnswers(Object.fromEntries(res.attempt.answers.map((a) => [a.questionId, a])));
        setPhase('running');
        viewStart.current = Date.now();
        // Reloaded, or reopened without full screen: that's leaving full screen (the server already
        // counted it as SESSION_LOST when it gave this page a new session).
        // (iPhone mode: a reload means the page was left - counted like switching away)
        if (phone && !res.sessionToken && !fromStart) sendViolation('TAB_SWITCH', 'no full screen: page reloaded or reopened');
        else if (!phone && !fullscreenElement() && !res.sessionToken && !fromStart) sendViolation('FULLSCREEN_EXIT', 'page reloaded or reopened outside full screen');
        // reopened after closing/crashing: the server counted it and gave this page a new session
        // (without full screen the server counted it as leaving the page: a tab switch)
        else if (res.sessionToken && !fromStart) {
          setWarning(phone ? { kind: 'tab', used: res.attempt.tabSwitches, allowed: res.quiz.settings?.allowedTabSwitches ?? 0 } : { kind: 'fullscreen', used: res.attempt.fullscreenExits, allowed: res.quiz.settings?.allowedFullscreenExits ?? 0 });
        }
      } catch (e) {
        if (!live) return;
        setMessage(e.message);
        setPhase(e.response?.status === 409 ? 'blocked' : 'error');
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // ---- clock ----
  const msLeft = useCountdown(expiresAt, serverNow);
  const warned = useRef({});
  useEffect(() => {
    if (phase !== 'running' || !expiresAt || msLeft == null) return;
    if (msLeft <= 5 * 60_000 && msLeft > 4 * 60_000 && !warned.current.five) {
      warned.current.five = true;
      setAnnounce('5 minutes left');
    }
    if (msLeft <= 60_000 && msLeft > 0 && !warned.current.one) {
      warned.current.one = true;
      setAnnounce('1 minute left');
    }
    if (msLeft === 0 && !endingRef.current) submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, phase, expiresAt]);

  // per-question timers tick once a second
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // ---- heartbeat: keeps this tab's session, syncs the clock, notices a server-side end ----
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const beat = async () => {
      try {
        const r = await api.heartbeat();
        setServerNow(r.serverNow);
        setExpiresAt(r.expiresAt);
        if (r.status !== 'in_progress') return ended(r.status, r);
        const queued = pendingViolations.current.splice(0);
        for (const v of queued) await sendViolation(v.type, v.meta);
      } catch {
        /* offline: the Reconnecting banner shows; the timer keeps running on server time */
      }
    };
    const t = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [phase, api, ended, sendViolation]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // ---- questions ----
  const q = questions[current];
  // first view of a timed question starts its timer (on the server too)
  useEffect(() => {
    if (!q || q.timeLimitSec <= 0 || answers[q._id]?.firstSeenAt || localSeen.current[q._id]) return;
    localSeen.current[q._id] = Date.now();
    autosave.queue({ questionId: q._id, seen: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?._id]);

  const questionTimeLeft = (() => {
    void tick;
    if (!q || q.timeLimitSec <= 0) return null;
    const seen = answers[q._id]?.firstSeenAt ? new Date(answers[q._id].firstSeenAt).getTime() : localSeen.current[q._id];
    if (!seen) return q.timeLimitSec;
    return Math.max(0, Math.ceil(q.timeLimitSec - (Date.now() - seen) / 1000));
  })();

  const recordTime = () => {
    if (!q) return;
    const now = Date.now();
    timeSpent.current[q._id] = (timeSpent.current[q._id] ?? answers[q._id]?.timeSpentSec ?? 0) + (now - viewStart.current) / 1000;
    viewStart.current = now;
    autosave.queue({ questionId: q._id, timeSpentSec: Math.round(timeSpent.current[q._id]) });
  };
  const goTo = (i) => {
    if (i < 0 || i >= questions.length || i === current) return;
    recordTime();
    setCurrent(i);
    setPaletteOpen(false);
  };
  const setSelected = (selected) => {
    setAnswers((a) => ({ ...a, [q._id]: { ...a[q._id], selected } }));
    autosave.queue({ questionId: q._id, selected });
  };
  const toggleMark = () => {
    const next = !answers[q._id]?.markedForReview;
    setAnswers((a) => ({ ...a, [q._id]: { ...a[q._id], markedForReview: next } }));
    autosave.queue({ questionId: q._id, markedForReview: next });
  };

  // ---- submit ----
  async function submit(auto = false) {
    if (endingRef.current && !auto) return;
    endingRef.current = true;
    setSubmitting(true);
    setConfirmOpen(false);
    recordTime();
    // send what's still waiting (a few tries)
    for (let i = 0; i < 6 && autosave.hasPending(); i++) {
      await autosave.flush();
      if (autosave.hasPending()) await new Promise((r) => setTimeout(r, 800));
    }
    try {
      const r = await api.submit(auto);
      exitFullscreen();
      if (r.status === 'disqualified') return ended('disqualified');
      toResult();
    } catch (e) {
      if (e.response?.status === 409 || e.response?.status === 404) return toResult();
      setSubmitting(false);
      endingRef.current = auto; // after the time is up there's no going back to answering
      setMessage(!e.response ? 'No connection - your answers are saved. Trying to submit again…' : e.message);
      setTimeout(() => submit(auto), 3000);
    }
  }

  const counts = useMemo(() => {
    let answered = 0;
    let marked = 0;
    for (const qq of questions) {
      if (answers[qq._id]?.selected?.length) answered += 1;
      if (answers[qq._id]?.markedForReview) marked += 1;
    }
    return { answered, unanswered: questions.length - answered, marked };
  }, [questions, answers]);

  // ---- screens ----
  if (phase === 'disqualified') return <DisqualifiedScreen at={dq?.at} reason={dq?.reason} onDone={toResult} />;
  if (phase === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--ds-bg)]" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-ds-fg-3" /> <span className="sr-only">Loading the test</span>
      </div>
    );
  }
  if (phase === 'blocked' || phase === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--ds-bg)] p-6">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
          <p className="mt-3 text-[16px] text-ink">{message || 'This test could not be opened.'}</p>
          <button className="btn-secondary mt-5" onClick={() => navigate('/quiz?tab=attempts')}>Back to my tests</button>
        </div>
      </div>
    );
  }

  const needsFullscreen = phone ? Boolean(warning) : !isFullscreen || warning;
  const locked = questionTimeLeft === 0 || submitting;

  return (
    <div className="flex min-h-dvh select-none flex-col bg-[var(--ds-bg)] text-ink" onCopy={(e) => e.preventDefault()}>
      <p className="sr-only" aria-live="assertive">{announce}</p>
      {/* header: title, timer, save status, submit */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-[var(--ds-surface)] px-4 py-2.5 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate font-editorial text-[17px] font-medium">{quiz?.title}</p>
          <p className="muted flex items-center gap-1.5 text-[12px]" aria-live="polite">
            {!online || autosave.status === 'offline' ? (
              <span className="flex items-center gap-1 text-warning"><CloudOff className="h-3.5 w-3.5" /> Reconnecting… answers kept on this device</span>
            ) : autosave.status === 'saving' || autosave.pending ? (
              <span className="flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
            ) : autosave.status === 'saved' ? (
              <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>
            ) : (
              <span>
                {counts.answered} of {questions.length} answered
              </span>
            )}
          </p>
        </div>
        <Timer msLeft={msLeft} />
        <button className="btn-ghost min-h-10 min-w-10 p-2 lg:hidden" onClick={() => setPaletteOpen((o) => !o)} aria-label="Question list" aria-expanded={paletteOpen}>
          <LayoutGrid className="h-5 w-5" />
        </button>
        <button className="btn-primary min-h-10 px-4" onClick={() => setConfirmOpen(true)} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} <span className="hidden sm:inline">Submit</span>
        </button>
      </header>
      {message && phase === 'running' && <p className="bg-warning-soft px-4 py-2 text-center text-[13px]" role="status">{message}</p>}

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <main className="min-w-0 flex-1" aria-label="Question">
          {q && (
            <QuestionView
              key={q._id}
              question={q}
              number={current + 1}
              total={questions.length}
              selected={answers[q._id]?.selected ?? []}
              onChange={setSelected}
              disabled={locked}
              timeLeft={questionTimeLeft}
            />
          )}
          {questionTimeLeft === 0 && <p className="mt-3 text-[13px] text-danger">Time is up for this question; its answer is locked.</p>}
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button className="btn-secondary" onClick={() => goTo(current - 1)} disabled={current === 0}>
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>
            <button className={cn('btn-ghost', answers[q?._id]?.markedForReview && 'text-warning')} onClick={toggleMark} aria-pressed={Boolean(answers[q?._id]?.markedForReview)}>
              {answers[q?._id]?.markedForReview ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} Mark for review
            </button>
            <button className="btn-ghost" onClick={() => setSelected([])} disabled={locked || !answers[q?._id]?.selected?.length}>
              <Eraser className="h-4 w-4" /> Clear response
            </button>
            <button className="btn-primary ml-auto" onClick={() => (current === questions.length - 1 ? setConfirmOpen(true) : goTo(current + 1))}>
              {current === questions.length - 1 ? 'Finish' : 'Next'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </main>

        {/* palette: a sidebar on large screens, a sheet on small ones */}
        <aside className={cn('w-72 shrink-0', paletteOpen ? 'fixed inset-x-0 bottom-0 z-40 w-auto rounded-t-[20px] border-t border-line bg-[var(--ds-surface)] p-4 shadow-lg lg:static lg:p-0 lg:shadow-none' : 'hidden lg:block')}>
          {paletteOpen && (
            <button className="btn-ghost absolute right-2 top-2 min-h-10 min-w-10 p-2 lg:hidden" onClick={() => setPaletteOpen(false)} aria-label="Close question list">
              <X className="h-5 w-5" />
            </button>
          )}
          <div className="lg:sticky lg:top-20">
            <p className="ds-eyebrow mb-2">Questions</p>
            <QuestionPalette questions={questions} answers={answers} current={current} onJump={goTo} />
          </div>
        </aside>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit the test?"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmOpen(false)}>Keep working</button>
            <button className="btn-primary" onClick={() => submit(false)}>Submit now</button>
          </div>
        }
      >
        <div className="space-y-3 px-5 py-4 text-[15px]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[12px] border border-line py-3"><p className="ds-num text-[22px] font-semibold text-success">{counts.answered}</p><p className="muted text-[12px]">Answered</p></div>
            <div className="rounded-[12px] border border-line py-3"><p className="ds-num text-[22px] font-semibold text-danger">{counts.unanswered}</p><p className="muted text-[12px]">Not answered</p></div>
            <div className="rounded-[12px] border border-line py-3"><p className="ds-num text-[22px] font-semibold text-warning">{counts.marked}</p><p className="muted text-[12px]">For review</p></div>
          </div>
          <p className="text-ds-fg-2">You can't change your answers after submitting.</p>
        </div>
      </Modal>

      {needsFullscreen && !endingRef.current && (
        <ProctorWarningModal
          used={warning?.used ?? 0}
          allowed={warning?.allowed ?? 0}
          kind={warning?.kind}
          phone={phone}
          onReturn={async () => {
            try {
              if (!phone && !fullscreenElement()) await enterFullscreen();
              setWarning(null);
            } catch {
              /* stays up until full screen works */
            }
          }}
        />
      )}
    </div>
  );
}
