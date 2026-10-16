import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, Download, Eye, FileUp, Lock, Plus, Rocket, Save } from 'lucide-react';
import { PageShell } from '../../components/Layout';
import { EmptyState, ErrorState, PageLoader, Spinner, Toggle } from '../../components/ui';
import QuestionEditor, { blankQuestion } from '../../components/quiz/QuestionEditor';
import QuestionView from '../../components/quiz/QuestionView';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { importQuestions, useHostStatus, useQuizForOrganizer, useSaveQuiz } from '../../hooks/useQuiz';
import { canHostTests } from '../../components/quiz/Hosting';
import { useAuthStore } from '../../store/auth';
import { CSV_TEMPLATE, FULLSCREEN_REQUIRED, JSON_TEMPLATE, downloadText, fmtDateTime, fromLocalInput, newId, plural, toLocalInput } from '../../lib/quiz';
import { cn } from '../../lib/format';
import { toast } from '../../store/ui';

const STEPS = ['Details', 'Schedule', 'Questions', 'Settings', 'Review & publish'];
const DEFAULT_SETTINGS = {
  shuffleQuestions: false,
  shuffleOptions: false,
  maxAttempts: 1,
  passPercent: 40,
  partialMarking: false,
  resultVisibility: 'after_end',
  showAnswers: true,
  showLeaderboard: true,
  allowedFullscreenExits: 0,
  allowedTabSwitches: 0,
  maxParticipants: 0,
  inviteOnly: false,
  desktopOnly: false,
  listed: true,
};

const empty = () => ({
  title: '',
  description: '',
  instructions: '',
  category: '',
  difficulty: '',
  startTime: null,
  endTime: null,
  durationMinutes: 30,
  questions: [blankQuestion('single')],
  settings: { ...DEFAULT_SETTINGS },
});

/** The form's shape from a saved test. */
const fromQuiz = (q) => ({
  title: q.title ?? '',
  description: q.description ?? '',
  instructions: q.instructions ?? '',
  category: q.category ?? '',
  difficulty: q.difficulty ?? '',
  startTime: q.startTime ?? null,
  endTime: q.endTime ?? null,
  durationMinutes: q.durationMinutes ?? 30,
  questions: (q.questions ?? []).map((x) => ({
    _id: x._id,
    type: x.type,
    text: x.text ?? '',
    image: x.image ?? '',
    options: (x.options ?? []).map((o) => ({ _id: o._id, text: o.text ?? '' })),
    correctAnswers: x.correctAnswers ?? [],
    numericTolerance: x.numericTolerance ?? 0,
    marks: x.marks ?? 1,
    negativeMarks: x.negativeMarks ?? 0,
    explanation: x.explanation ?? '',
    timeLimitSec: x.timeLimitSec ?? 0,
  })),
  // tests saved before listing existed are private (code-only)
  settings: { ...DEFAULT_SETTINGS, listed: false, ...(q.settings ?? {}) },
});

/** Problems to fix before publishing (the server checks the same). */
function problemsOf(f) {
  const p = [];
  if (!f.title.trim()) p.push({ step: 0, text: 'Add a title.' });
  if (!f.startTime || !f.endTime) p.push({ step: 1, text: 'Set when the test opens and closes.' });
  else {
    if (new Date(f.endTime) <= new Date(f.startTime)) p.push({ step: 1, text: 'The closing time must be after the opening time.' });
    if (new Date(f.endTime) <= new Date()) p.push({ step: 1, text: 'The closing time is in the past.' });
  }
  if (!(f.durationMinutes >= 1)) p.push({ step: 1, text: 'Set the duration.' });
  if (!f.questions.length) p.push({ step: 2, text: 'Add at least one question.' });
  f.questions.forEach((q, i) => {
    const n = `Question ${i + 1}`;
    if (!q.text.trim()) p.push({ step: 2, text: `${n}: write the question.` });
    if (!(q.marks > 0)) p.push({ step: 2, text: `${n}: marks must be more than 0.` });
    if (q.type === 'short') {
      if (!q.correctAnswers.some((c) => c.trim())) p.push({ step: 2, text: `${n}: add an accepted answer.` });
    } else {
      if (q.options.length < 2) p.push({ step: 2, text: `${n}: add at least 2 options.` });
      if (q.options.some((o) => !o.text.trim())) p.push({ step: 2, text: `${n}: an option is empty.` });
      if (!q.correctAnswers.length) p.push({ step: 2, text: `${n}: mark the correct answer.` });
    }
  });
  return p;
}

const toBody = (f) => ({ ...f, questions: f.questions.map((q) => ({ ...q, correctAnswers: q.correctAnswers.map((c) => c.trim()).filter(Boolean) })) });

function Field({ label, hint, htmlFor, children }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label} {hint && <span className="muted font-normal">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Stepper({ step, onStep }) {
  return (
    <ol className="no-scrollbar flex gap-1 overflow-x-auto border-t border-line px-3 py-2" aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => onStep(i)}
            aria-current={i === step ? 'step' : undefined}
            className={cn('flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium', i === step ? 'bg-ds-brand-soft text-ds-brand-text' : 'text-ds-fg-3 hover:bg-surface-2')}
          >
            <span className={cn('ds-num flex h-5 w-5 items-center justify-center rounded-full text-[11px]', i === step ? 'bg-ds-brand text-ds-on-brand' : 'border border-line')}>{i + 1}</span>
            {s}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Create a test (/quiz/create) or edit one (/quiz/:id/edit), in five steps. */
export default function QuizEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = Math.min(4, Math.max(0, Number(params.get('step') ?? 0) || 0));
  const setStep = (s) => setParams({ step: String(s) }, { replace: true });
  const existing = useQuizForOrganizer(id);
  const save = useSaveQuiz(id);
  const qc = useQueryClient();
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState(() => (id ? null : empty()));
  const [dirty, setDirty] = useState(false);
  const [publishProblems, setPublishProblems] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [preview, setPreview] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const user = useAuthStore((s) => s.user);
  const host = canHostTests(user);
  const hostStatus = useHostStatus(host);

  // load once (later refetches must not wipe what's being typed)
  if (id && existing.data && !form) setForm(fromQuiz(existing.data));

  // leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const q = existing.data;
  const locked = Boolean(q && (q.attemptCount > 0 || (q.status === 'published' && q.phase !== 'scheduled')));
  const totalMarks = useMemo(() => Math.round((form?.questions ?? []).reduce((n, x) => n + (Number(x.marks) || 0), 0) * 100) / 100, [form]);
  const problems = useMemo(() => (form ? problemsOf(form) : []), [form]);

  if (id && existing.isPending) return <PageShell title="Edit test"><PageLoader /></PageShell>;
  if (id && existing.isError) return <PageShell title="Edit test"><ErrorState error={existing.error} onRetry={existing.refetch} /></PageShell>;
  if (!form) return <PageShell title="Edit test"><PageLoader /></PageShell>;
  if (!id && !host) {
    return (
      <PageShell title="Create a test">
        <EmptyState
          icon={Building2}
          title={user?.quizHost === 'pending' ? 'Your application is being reviewed' : 'Only approved quiz hosts can create tests'}
          action={<Link to="/quiz" className="btn-primary">Go to Tests</Link>}
        >
          {user?.quizHost === 'pending'
            ? "Tectum is reviewing your application to conduct quizzes. You'll get a notification once it's approved, and then you can create tests here."
            : 'Apply from the Tests page ("Host quizzes"). Your first 2 quizzes are free.'}
        </EmptyState>
      </PageShell>
    );
  }

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const setSetting = (k, v) => set({ settings: { ...form.settings, [k]: v } });
  const setQuestion = (i, next) => set({ questions: form.questions.map((x, j) => (j === i ? next : x)) });
  const move = (from, to) => {
    if (to < 0 || to >= form.questions.length || from === to) return;
    const list = [...form.questions];
    const [it] = list.splice(from, 1);
    list.splice(to, 0, it);
    set({ questions: list });
  };

  /** Saves; a new test is created the first time and the address becomes its edit page. */
  const doSave = async ({ quiet = false } = {}) => {
    const saved = await save.mutateAsync(toBody(form));
    setDirty(false);
    if (!quiet) toast(id ? 'Saved' : 'Draft saved');
    if (!id) navigate(`/quiz/${saved._id}/edit?step=${step}`, { replace: true });
    return saved;
  };

  const doPublish = async () => {
    if (problems.length) return setPublishProblems(problems);
    setPublishing(true);
    try {
      const saved = await doSave({ quiet: true });
      // a brand-new test has its id only now
      await api.post(`/quizzes/${saved._id}/publish`);
      qc.invalidateQueries({ queryKey: ['quiz'] });
      toast(form.settings.listed ? 'Published - it is on your profile for students to register' : 'Published - share the code with participants');
      navigate(`/quiz/${saved._id}/manage`, { replace: true });
    } catch (e) {
      const list = e.response?.data?.problems;
      setPublishProblems(list ? list.map((text) => ({ step: 2, text })) : [{ step: 4, text: e.message }]);
    } finally {
      setPublishing(false);
    }
  };

  const onImportFile = async (file) => {
    if (!file) return;
    if (file.size > 500 * 1024) return toast('That file is too big (500 KB at most)', 'error');
    const format = /\.json$/i.test(file.name) ? 'json' : 'csv';
    setImporting(true);
    try {
      const saved = id ? q : await doSave({ quiet: true });
      const content = await file.text();
      const res = await importQuestions(saved._id, format, content);
      const keep = form.questions.filter((x) => x.text.trim() || x.options.some((o) => o.text.trim() && x.type !== 'truefalse'));
      set({ questions: [...keep, ...res.questions.map((x) => ({ ...x, _id: x._id ?? newId() }))] });
      toast(`${plural(res.questions.length, 'question')} added${res.errors.length ? ` · ${res.errors.length} skipped` : ''}`, res.errors.length ? 'error' : undefined);
      if (res.errors.length) setPublishProblems(res.errors.map((text) => ({ step: 2, text })));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const durationTooLong = form.startTime && form.endTime && form.durationMinutes * 60000 > new Date(form.endTime) - new Date(form.startTime);

  return (
    <PageShell
      title={id ? 'Edit test' : 'Create a test'}
      subtitle={form.title || 'Untitled test'}
      wide
      actions={
        <button className="btn-secondary min-h-9 px-3 text-[14px]" onClick={() => doSave()} disabled={save.isPending}>
          {save.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} {q?.status === 'published' ? 'Save' : 'Save draft'}
        </button>
      }
      tabs={<Stepper step={step} onStep={setStep} />}
    >
      <div className="space-y-5 px-4 py-5 sm:px-6">
        {locked && (
          <p className="flex items-start gap-2 rounded-[12px] bg-warning-soft px-4 py-3 text-[14px] text-ink" role="note">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            People have started this test, so the questions, timing and anti-cheating rules can no longer change. You can still edit the title, descriptions and how results are shown.
          </p>
        )}

        {step === 0 && (
          <section className="space-y-4" aria-label="Details">
            <Field label="Title" htmlFor="qz-title">
              <input id="qz-title" className="input" value={form.title} maxLength={150} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Pharmacology mock test - autonomic drugs" autoFocus />
            </Field>
            <Field label="Description" hint="what the test covers" htmlFor="qz-desc">
              <textarea id="qz-desc" className="input min-h-20" value={form.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Subject / category" htmlFor="qz-cat">
                <input id="qz-cat" className="input" value={form.category} maxLength={60} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Pharmacology" />
              </Field>
              <Field label="Difficulty" hint="optional" htmlFor="qz-diff">
                <select id="qz-diff" className="input" value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                  <option value="">Not set</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
            </div>
            <Field label="Instructions for participants" hint="shown before they start" htmlFor="qz-ins">
              <textarea id="qz-ins" className="input min-h-32" value={form.instructions} maxLength={6000} onChange={(e) => set({ instructions: e.target.value })} placeholder="e.g. 30 questions, +4 / −1. Use a pen and paper for rough work." />
            </Field>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4" aria-label="Schedule">
            <p className="muted text-[14px]">Participants can start any time between the opening and closing times. Times are in your time zone.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opens at" htmlFor="qz-start">
                <input id="qz-start" type="datetime-local" className="input" disabled={locked} value={toLocalInput(form.startTime)} onChange={(e) => set({ startTime: fromLocalInput(e.target.value) })} />
              </Field>
              <Field label="Closes at" htmlFor="qz-end">
                <input id="qz-end" type="datetime-local" className="input" disabled={locked} value={toLocalInput(form.endTime)} onChange={(e) => set({ endTime: fromLocalInput(e.target.value) })} />
              </Field>
            </div>
            <Field label="Duration (minutes)" hint="the timer starts when each participant starts" htmlFor="qz-dur">
              <input id="qz-dur" type="number" min="1" max="600" className="input max-w-40" disabled={locked} value={form.durationMinutes} onChange={(e) => set({ durationMinutes: Math.round(Number(e.target.value) || 0) })} />
            </Field>
            {durationTooLong && (
              <p className="flex items-start gap-2 text-[13px] text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> The duration is longer than the window: everyone's time will end when the test closes.
              </p>
            )}
            <p className="muted text-[13px]">A participant's time ends after the duration, or when the test closes, whichever comes first. Per-question time limits are set on each question.</p>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4" aria-label="Questions">
            {!locked && (
              <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-dashed border-line px-4 py-3">
                <FileUp className="h-4 w-4 text-ds-fg-3" />
                <span className="text-[14px] text-ds-fg-2">Import questions from a file</span>
                <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={(e) => onImportFile(e.target.files?.[0])} />
                <button type="button" className="btn-secondary min-h-9 px-3 text-[13px]" onClick={() => fileRef.current?.click()} disabled={importing}>
                  {importing ? 'Importing…' : 'Choose CSV or JSON'}
                </button>
                <span className="muted ml-auto flex gap-1 text-[13px]">
                  Templates:
                  <button type="button" className="text-link underline" onClick={() => downloadText('tectum-test-template.csv', `\uFEFF${CSV_TEMPLATE}`, 'text/csv')}>
                    <Download className="inline h-3.5 w-3.5" /> CSV
                  </button>
                  <button type="button" className="text-link underline" onClick={() => downloadText('tectum-test-template.json', JSON_TEMPLATE, 'application/json')}>
                    <Download className="inline h-3.5 w-3.5" /> JSON
                  </button>
                </span>
              </div>
            )}
            <ol className="space-y-4">
              {form.questions.map((qq, i) => (
                <li key={qq._id}>
                  <QuestionEditor
                    question={qq}
                    index={i}
                    total={form.questions.length}
                    locked={locked}
                    onChange={(next) => setQuestion(i, next)}
                    onDelete={() => (form.questions.length === 1 || window.confirm(`Delete question ${i + 1}?`)) && set({ questions: form.questions.filter((_, j) => j !== i) })}
                    onMove={(d) => move(i, i + d)}
                    onDuplicate={() => {
                      const copy = { ...qq, _id: newId(), options: qq.options.map((o) => ({ ...o, _id: newId() })) };
                      const map = new Map(qq.options.map((o, k) => [o._id, copy.options[k]._id]));
                      copy.correctAnswers = qq.type === 'short' ? [...qq.correctAnswers] : qq.correctAnswers.map((c) => map.get(c)).filter(Boolean);
                      const list = [...form.questions];
                      list.splice(i + 1, 0, copy);
                      set({ questions: list });
                    }}
                    dragging={dragIndex === i}
                    dragHandlers={
                      locked
                        ? {}
                        : {
                            draggable: true,
                            onDragStart: (e) => {
                              // only when dragging by the card, not while selecting text in a field
                              if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return e.preventDefault();
                              setDragIndex(i);
                              e.dataTransfer.effectAllowed = 'move';
                            },
                            onDragOver: (e) => {
                              e.preventDefault();
                              if (dragIndex !== null && dragIndex !== i) {
                                move(dragIndex, i);
                                setDragIndex(i);
                              }
                            },
                            onDragEnd: () => setDragIndex(null),
                          }
                    }
                  />
                </li>
              ))}
            </ol>
            {!locked && (
              <div className="flex flex-wrap gap-2">
                {['single', 'multiple', 'truefalse', 'short'].map((t) => (
                  <button key={t} type="button" className="btn-secondary text-[13px]" onClick={() => set({ questions: [...form.questions, blankQuestion(t)] })}>
                    <Plus className="h-4 w-4" /> {t === 'single' ? 'Single answer' : t === 'multiple' ? 'Multiple answers' : t === 'truefalse' ? 'True / False' : 'Short answer'}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-5" aria-label="Settings">
            <div className="rounded-[12px] border border-line">
              <Toggle
                label="Show on my profile - students register, I accept them"
                description={
                  form.settings.listed
                    ? 'Listed in your Tests tab and in Tests → Quizzes. Students send their name and college; only those you accept can start it.'
                    : 'Private: only people you give the access code to can take it.'
                }
                checked={form.settings.listed}
                onChange={(v) => setSetting('listed', v)}
              />
            </div>
            <div className="divide-y divide-line rounded-[12px] border border-line">
              <Toggle label="Shuffle questions" description="Each participant gets the questions in a different order." checked={form.settings.shuffleQuestions} onChange={(v) => !locked && setSetting('shuffleQuestions', v)} />
              <Toggle label="Shuffle options" description="Options of each question in a different order (True/False stays in place)." checked={form.settings.shuffleOptions} onChange={(v) => !locked && setSetting('shuffleOptions', v)} />
              <Toggle label="Partial marks for multiple-answer questions" description="A share of the marks for each right option chosen. Off: all-or-nothing." checked={form.settings.partialMarking} onChange={(v) => !locked && setSetting('partialMarking', v)} />
              <Toggle label="Show correct answers in the review" description="With the explanations, once results are released." checked={form.settings.showAnswers} onChange={(v) => setSetting('showAnswers', v)} />
              <Toggle label="Show the leaderboard to participants" checked={form.settings.showLeaderboard} onChange={(v) => setSetting('showLeaderboard', v)} />
              {!form.settings.listed && <Toggle label="Invited members only" description="The code works only for people you invite." checked={form.settings.inviteOnly} onChange={(v) => setSetting('inviteOnly', v)} />}
              <Toggle label="Desktop / laptop only" description="Block phones and tablets." checked={form.settings.desktopOnly} onChange={(v) => !locked && setSetting('desktopOnly', v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="When participants see results" htmlFor="qz-vis">
                <select id="qz-vis" className="input" value={form.settings.resultVisibility} onChange={(e) => setSetting('resultVisibility', e.target.value)}>
                  <option value="after_end">After the test closes (prevents answers leaking)</option>
                  <option value="immediate">Straight after they submit</option>
                </select>
              </Field>
              <Field label="Pass mark (%)" htmlFor="qz-pass">
                <input id="qz-pass" type="number" min="0" max="100" className="input" disabled={locked} value={form.settings.passPercent} onChange={(e) => setSetting('passPercent', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
              </Field>
              <Field label="Attempts per person" htmlFor="qz-att">
                <select id="qz-att" className="input" disabled={locked} value={form.settings.maxAttempts} onChange={(e) => setSetting('maxAttempts', Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Maximum participants" hint="0 = no limit" htmlFor="qz-max">
                <input id="qz-max" type="number" min="0" className="input" value={form.settings.maxParticipants} onChange={(e) => setSetting('maxParticipants', Math.max(0, Math.round(Number(e.target.value) || 0)))} />
              </Field>
              {/* full screen is switched off for now (lib/quiz.js FULLSCREEN_REQUIRED) */}
              {FULLSCREEN_REQUIRED && (
                <Field label="Full-screen exits allowed" hint="0 = disqualified on the first (strict)" htmlFor="qz-fs">
                  <select id="qz-fs" className="input" disabled={locked} value={form.settings.allowedFullscreenExits} onChange={(e) => setSetting('allowedFullscreenExits', Number(e.target.value))}>
                    <option value={0}>0 - strict (recommended)</option>
                    <option value={1}>1 warning</option>
                    <option value={2}>2 warnings</option>
                  </select>
                </Field>
              )}
              <Field label={FULLSCREEN_REQUIRED ? 'Tab / window switches allowed' : 'Leaving the test page allowed'} hint={FULLSCREEN_REQUIRED ? '0 = strict' : 'Switching tab, window or app, or reloading. 0 = strict'} htmlFor="qz-tab">
                <select id="qz-tab" className="input" disabled={locked} value={form.settings.allowedTabSwitches} onChange={(e) => setSetting('allowedTabSwitches', Number(e.target.value))}>
                  <option value={0}>0 - strict (recommended)</option>
                  <option value={1}>1 warning</option>
                  <option value={2}>2 warnings</option>
                </select>
              </Field>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-5" aria-label="Review and publish">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[12px] border border-line px-4 py-3"><p className="ds-eyebrow">Questions</p><p className="ds-num font-editorial text-[24px]">{form.questions.length}</p></div>
              <div className="rounded-[12px] border border-line px-4 py-3"><p className="ds-eyebrow">Total marks</p><p className="ds-num font-editorial text-[24px]">{totalMarks}</p></div>
              <div className="rounded-[12px] border border-line px-4 py-3"><p className="ds-eyebrow">Duration</p><p className="ds-num font-editorial text-[24px]">{form.durationMinutes} min</p></div>
            </div>
            <p className="text-[14px] text-ds-fg-2">
              Opens {form.startTime ? fmtDateTime(form.startTime) : '—'} · closes {form.endTime ? fmtDateTime(form.endTime) : '—'}
            </p>
            {(publishProblems.length > 0 || problems.length > 0) && q?.status !== 'published' && (
              <div className="rounded-[12px] bg-danger-soft px-4 py-3" role="alert">
                <p className="font-semibold text-danger">Fix these before publishing:</p>
                <ul className="mt-1 space-y-0.5 text-[14px]">
                  {(publishProblems.length ? publishProblems : problems).slice(0, 12).map((p, i) => (
                    <li key={i}>
                      <button className="text-left text-ink underline decoration-dotted" onClick={() => setStep(p.step)}>{p.text}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-[14px] border border-line">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <Eye className="h-4 w-4 text-ds-fg-3" />
                <span className="text-[14px] font-medium">Preview - what participants see</span>
                <span className="muted ml-auto text-[13px]">{form.questions.length ? `${preview + 1} / ${form.questions.length}` : ''}</span>
              </div>
              {form.questions.length ? (
                <div className="p-4 sm:p-6">
                  <QuestionView question={form.questions[Math.min(preview, form.questions.length - 1)]} number={Math.min(preview, form.questions.length - 1) + 1} total={form.questions.length} selected={[]} onChange={() => {}} />
                  <div className="mt-5 flex justify-between">
                    <button className="btn-ghost" onClick={() => setPreview((p) => Math.max(0, p - 1))} disabled={preview === 0}><ArrowLeft className="h-4 w-4" /> Previous</button>
                    <button className="btn-ghost" onClick={() => setPreview((p) => Math.min(form.questions.length - 1, p + 1))} disabled={preview >= form.questions.length - 1}>Next <ArrowRight className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <p className="muted p-6 text-center">No questions yet.</p>
              )}
            </div>
            {q?.status === 'published' ? (
              <p className="flex items-center gap-2 text-[14px] text-success"><Check className="h-4 w-4" /> Published. <Link className="text-link underline" to={`/quiz/${id}/manage`}>Manage the test and share the code</Link></p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {!host && <p className="w-full text-[14px] text-danger">Only approved quiz hosts can publish. You can still save this draft.</p>}
                {host && hostStatus.data && !user?.isAdmin && (
                  <p className={cn('w-full text-[14px]', hostStatus.data.freeLeft ? 'text-ds-fg-2' : 'text-warning')}>
                    {hostStatus.data.freeLeft
                      ? `This quiz is free (${hostStatus.data.freeLeft} of your ${hostStatus.data.freeTests} free quizzes left).`
                      : `You've used your ${hostStatus.data.freeTests} free quizzes: a minimal upload charge applies to this quiz. Tectum will contact you about it.`}
                  </p>
                )}
                <button className="btn-primary" onClick={doPublish} disabled={publishing || save.isPending || !host}>
                  <Rocket className="h-4 w-4" /> {form.settings.listed ? 'Publish on my profile' : 'Publish and get the code'}
                </button>
                <button className="btn-secondary" onClick={() => doSave()} disabled={save.isPending}>
                  <Save className="h-4 w-4" /> Save as draft
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* running totals + step navigation */}
      <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-line bg-[var(--ds-surface)] px-4 py-3 sm:px-6">
        <span className="muted text-[13px]">
          {plural(form.questions.length, 'question')} · {totalMarks} marks{dirty ? ' · unsaved changes' : ''}
        </span>
        <div className="ml-auto flex gap-2">
          {step > 0 && <button className="btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" /> Back</button>}
          {step < 4 && <button className="btn-primary" onClick={() => setStep(step + 1)}>Next <ArrowRight className="h-4 w-4" /></button>}
        </div>
      </div>
    </PageShell>
  );
}
