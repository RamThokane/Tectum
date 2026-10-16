import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, KeyRound } from 'lucide-react';
import { PageShell } from '../../components/Layout';
import { Spinner } from '../../components/ui';
import { joinWithCode } from '../../hooks/useQuiz';
import { normalizeCode } from '../../lib/quiz';

/**
 * Enter a test's access code (or arrive from an invitation link, /quiz/join?code=…). A valid code
 * leads to the test's instructions page; the reasons someone can't take it are shown here.
 */
export default function QuizJoin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => normalizeCode(params.get('code')));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null); // { title?, text }
  const autoTried = useRef(false);

  const join = async (value = code) => {
    const c = normalizeCode(value);
    if (c.length < 6) return setProblem({ text: 'Enter the 8-character code you were given.' });
    setBusy(true);
    setProblem(null);
    try {
      const { quiz, eligibility } = await joinWithCode(c);
      if (eligibility.state === 'blocked') setProblem({ title: quiz.title, text: eligibility.reason, register: eligibility.needsRegistration ? quiz._id : null });
      else navigate(`/quiz/${quiz._id}/instructions`);
    } catch (e) {
      setProblem({ text: e.message });
    } finally {
      setBusy(false);
    }
  };

  // from an invitation link: go straight on
  useEffect(() => {
    const c = normalizeCode(params.get('code'));
    if (c && !autoTried.current) {
      autoTried.current = true;
      join(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageShell title="Join a test">
      <form
        className="mx-auto max-w-md space-y-5 px-4 py-8"
        onSubmit={(e) => {
          e.preventDefault();
          join();
        }}
      >
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line text-ds-fg-3">
            <KeyRound className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <p className="text-[15px] text-ds-fg-2">Enter the access code the organizer shared with you.</p>
        </div>
        <div>
          <label className="label" htmlFor="quiz-code">Access code</label>
          <input
            id="quiz-code"
            className="input text-center font-mono text-[24px] tracking-[0.2em] uppercase"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 8))}
            placeholder="ABCD2345"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={16}
            autoFocus
            aria-describedby={problem ? 'join-problem' : undefined}
          />
        </div>
        {problem && (
          <div id="join-problem" className="flex gap-2 rounded-[12px] bg-danger-soft px-4 py-3 text-[14px]" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p>
              {problem.title && <strong className="block text-ink">{problem.title}</strong>}
              <span className="text-ink">{problem.text}</span>
              {problem.register && (
                <Link to={`/quiz/${problem.register}/details`} className="mt-1 block font-medium text-link hover:underline">
                  Open the test's page to register
                </Link>
              )}
            </p>
          </div>
        )}
        <button className="btn-primary w-full" disabled={busy || code.length < 6}>
          {busy ? <Spinner className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />} Continue
        </button>
      </form>
    </PageShell>
  );
}
