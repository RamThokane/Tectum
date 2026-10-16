import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Menu,
  X,
  Stethoscope,
  Sparkles,
  Hospital,
  Layers,
  NotebookPen,
  BadgeCheck,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  CircleCheck,
  UserPlus,
  MessagesSquare,
  Target,
  GraduationCap,
  ShieldCheck,
  Mail,
  Quote,
  HelpCircle,
  Globe,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import GoogleButton, { useGoogleClientId } from '../components/GoogleButton';
import { ThemeToggle, Logo } from '../components/Navbar';
import { LEGAL_DOCS } from '../lib/legal';
import { TRUST_STATS, TESTIMONIALS, SOCIAL, FAQ } from '../lib/landing';
import { CUES as FILM_CUES } from '../components/film/filmScript';
import { CollabIcon } from '../components/ds/icons';
import { cn } from '../lib/format';

const NAV = [
  ['#features', 'Features'],
  ['#how-it-works', 'How it works'],
  ['#students', 'For students'],
  ['#doctors', 'For doctors'],
  ['#faq', 'FAQ'],
];

/** A built-in teaching example, used only until a real case with a poll exists. No vote numbers. */
const FALLBACK_CASE = {
  title: 'Crushing chest pain in a 50s smoker',
  chiefComplaint: 'Central chest pain for 2 hours, radiating to the jaw, with sweating.',
  age: '50s',
  sex: 'male',
  examination: 'HR 52, BP 88/60, JVP raised, clear lung fields.',
  investigations: 'ECG: ST elevation in II, III and aVF.',
  options: ['Inferior STEMI with right ventricular involvement', 'Aortic dissection', 'Pulmonary embolism', 'Pericarditis'],
  correctOption: 0,
  counts: null,
  total: 0,
  diagnosis: 'Inferior STEMI with right ventricular infarction',
  learningPoint: 'Hypotension with a raised JVP and clear lungs in an inferior STEMI suggests RV infarction: avoid nitrates and give fluids cautiously while arranging reperfusion.',
};

const ageSex = (c) => [c.age, c.sex && c.sex[0].toUpperCase() + c.sex.slice(1)].filter(Boolean).join(' · ');

function useSampleCase() {
  const { data, isPending } = useQuery({
    queryKey: ['public', 'sample-case'],
    queryFn: () => api.get('/public/sample-case').then((r) => r.data.sample),
    staleTime: 5 * 60_000,
  });
  return { sample: data ?? (isPending ? null : FALLBACK_CASE), isPending };
}

// ---------------------------------------------------------------- navbar
function LandingNav() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);
  return (
    <header className="glass-3 sticky top-0 z-40 rounded-none border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
        <Logo compact />
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV.map(([href, label]) => (
            <li key={href}>
              <a href={href} className="rounded-full px-3 py-2 text-[13px] font-medium text-ds-fg-2 transition-colors hover:bg-surface-2 hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link to="/login" className="btn-ghost hidden sm:inline-flex">Log in</Link>
          <Link to="/signup" className="btn-primary">Join free</Link>
          <button className="btn-ghost min-h-11 min-w-11 p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="landing-menu" aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      {open && (
        <div id="landing-menu" className="animate-sheet border-t border-line px-4 pb-4 lg:hidden">
          <ul className="py-2">
            {NAV.map(([href, label]) => (
              <li key={href}>
                <a href={href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-[12px] px-3 text-[15px] font-medium hover:bg-surface-2">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary flex-1">Log in</Link>
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------- hero
/** Decorative Case-of-the-Day mock-up for the hero (the working one is further down). */
function CaseMock({ sample }) {
  const c = sample ?? FALLBACK_CASE;
  return (
    <div className="float-card card mx-auto w-full max-w-md p-5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="ds-eyebrow inline-flex items-center gap-1.5 text-link!"><Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} /> Case of the Day</span>
        <span className="chip font-code text-ds-fg-2">{ageSex(c) || 'Clinical case'}</span>
      </div>
      <p className="mt-3 font-editorial text-[20px] font-medium leading-[26px]">{c.title}</p>
      <p className="muted mt-1 line-clamp-2 text-[13px] leading-[18px]">{c.chiefComplaint}</p>
      <p className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold"><HelpCircle className="h-4 w-4 text-link" strokeWidth={1.5} /> What's your diagnosis?</p>
      <div className="mt-2 space-y-2">
        {c.options.slice(0, 3).map((o, i) => (
          <div key={o} className={cn('relative overflow-hidden rounded-[12px] border px-3 py-2.5 text-[13px] font-medium', i === c.correctOption ? 'border-success/50' : 'border-line')}>
            {i === c.correctOption && <div className="absolute inset-y-0 left-0 w-3/5 bg-success-soft" />}
            <span className="relative flex items-center gap-2">
              {o}
              {i === c.correctOption && <CircleCheck className="h-4 w-4 text-success" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero({ sample }) {
  return (
    <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20" aria-labelledby="hero-title">
      <div>
        <p className="chip mb-5 border-transparent bg-ds-brand-soft px-3 py-1 text-[13px] text-link">
          <Stethoscope className="h-4 w-4" /> For MBBS students, interns and doctors
        </p>
        <h1 id="hero-title" className="font-editorial text-[40px] font-medium leading-[44px] tracking-[-0.02em]">
          Learn medicine the way doctors think. <span className="italic text-ds-brand-text">One real case at a time.</span>
        </h1>
        <p className="muted mt-5 max-w-xl text-[17px] leading-[26px]">
          Solve de-identified clinical cases, discuss them with peers and clinicians, and lock in what you learn with smart spaced-repetition flashcards.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/signup" className="btn-primary min-h-12 px-6 text-[17px]">Join free <ChevronRight className="h-5 w-5" strokeWidth={1.75} /></Link>
          <a href="#sample-case" className="btn-secondary min-h-12 px-6 text-[17px]">Try a sample case</a>
        </div>
        <HeroGoogle />
        <p className="muted mt-4 flex items-center gap-1.5 text-[13px]"><ShieldCheck className="h-4 w-4" strokeWidth={1.5} /> Free forever for learners · no patient-identifying data</p>
      </div>
      <CaseMock sample={sample} />
    </section>
  );
}

/**
 * "Continue with Google" under the hero buttons (plus One Tap when the browser is already signed
 * in to Google). Members are signed straight in; new people continue to sign-up with their name
 * and email filled in, to choose role, course and country.
 */
function HeroGoogle() {
  const clientId = useGoogleClientId();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!clientId) return null;
  const withGoogle = async (credential) => {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/google', { credential });
      if (data.newUser) {
        navigate('/signup', { state: { google: { credential, ...data.profile } } });
        return;
      }
      setSession(data.user, data.token);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 max-w-[320px]">
      <GoogleButton onCredential={withGoogle} disabled={busy} oneTap context="signup" />
      {error && <p className="mt-2 text-[13px] text-danger" role="alert">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- trust strip
function TrustStrip() {
  const { data } = useQuery({
    queryKey: ['public', 'stats'],
    queryFn: () => api.get('/public/stats').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const shown = TRUST_STATS.filter((s) => s.show && data?.[s.key] > 0);
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-label="Tectum in numbers">
      <div className="glass-1 flex flex-col items-center justify-between gap-4 px-6 py-5 text-center sm:flex-row sm:text-left">
        <p className="font-editorial text-[17px] font-medium">Built for MBBS students, interns & doctors</p>
        <dl className="flex flex-wrap justify-center gap-x-8 gap-y-2">
          {data
            ? shown.map((s) => (
                <div key={s.key} className="flex items-baseline gap-1.5">
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="ds-num text-[28px] font-medium leading-8">{data[s.key].toLocaleString()}</dd>
                  <span className="ds-eyebrow" aria-hidden="true">{s.label}</span>
                </div>
              ))
            : [0, 1, 2].map((i) => <div key={i} className="h-7 w-32 animate-pulse rounded-[6px] bg-surface-2" />)}
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- the film
const TectumFilm = lazy(() => import('../components/film/TectumFilm'));

/** One-minute film. Its code only loads when the visitor scrolls near it; until then a dark frame holds its place. */
function FilmSection() {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const placeholder = <div className="mx-auto aspect-[4/5] max-w-[520px] rounded-[20px] bg-[#0a1222] min-[900px]:aspect-video min-[900px]:max-w-none" />;
  return (
    <section ref={ref} id="film" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-16 sm:px-6 lg:pt-20" aria-labelledby="film-title">
      <SectionHeading id="film-title" eyebrow="In one minute" title="How a case teaches you" />
      {/* edge to edge on phones */}
      <div className="-mx-4 mt-10 sm:mx-0">{near ? <Suspense fallback={placeholder}><TectumFilm /></Suspense> : placeholder}</div>
      <details className="group mx-auto mt-4 max-w-3xl text-[15px]">
        <summary className="muted mx-auto flex w-fit cursor-pointer list-none items-center gap-1 rounded-full px-3 py-1.5 text-[13px] hover:text-ink [&::-webkit-details-marker]:hidden">
          Read the transcript <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={1.5} aria-hidden="true" />
        </summary>
        <div className="card mt-3 space-y-2 p-5 leading-[23px]">
          {FILM_CUES.map((c) => (
            <p key={c.id}>{c.text}</p>
          ))}
        </div>
      </details>
    </section>
  );
}

// ---------------------------------------------------------------- features
const FEATURES = [
  { icon: Stethoscope, title: 'Case Rounds', text: 'Real, de-identified cases with history, exam findings, labs and images. Work them up like on rounds.' },
  { icon: Sparkles, title: 'Case of the Day', text: 'One hand-picked case every day. Think first, vote, then see how everyone else answered.' },
  { icon: Hospital, title: 'Wards', text: 'Subject channels from Anatomy to Cardiology, filtered by your MBBS year.' },
  { icon: Layers, title: 'Smart flashcards', text: 'Saved cases become flashcards scheduled with spaced repetition (Again, Hard, Good, Easy).' },
  { icon: NotebookPen, title: 'Notebook', text: 'Everything you save, organised by subject, with your own private notes.' },
  { icon: CollabIcon, title: 'Collaboration', text: 'Find research projects, audits and co-authors looking for students or colleagues.' },
  { icon: BadgeCheck, title: 'Verified doctors', text: 'Clinicians verify with their medical council registration, so you know who is teaching.' },
  { icon: TrendingUp, title: 'Progress tracking', text: 'Streaks, daily goals, accuracy and progress by specialty, with weak topics flagged.' },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6" aria-labelledby="features-title">
      <SectionHeading id="features-title" eyebrow="Features" title="Everything you need to think like a clinician" />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <li key={f.title} className="card card-hover p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-link">
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-editorial text-[20px] font-medium leading-[26px]">{f.title}</h3>
            <p className="muted mt-1.5 text-[15px] leading-[23px]">{f.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({ id, eyebrow, title, children }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="ds-eyebrow text-link!">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em] sm:text-[40px] sm:leading-[44px] sm:tracking-[-0.02em]">{title}</h2>
      {children && <p className="muted mt-3 text-[17px] leading-[26px]">{children}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- interactive sample case
function SampleCase({ sample, isPending }) {
  const [picked, setPicked] = useState(null);
  const c = sample;
  const answered = picked !== null;
  // With real votes, the visitor's pick is added to the real counts; the fallback shows no numbers.
  const counts = c?.counts ? c.counts.map((n, i) => n + (picked === i ? 1 : 0)) : null;
  const total = counts ? counts.reduce((a, b) => a + b, 0) : 0;
  const pct = (i) => (total ? Math.round((counts[i] / total) * 100) : 0);

  return (
    <section id="sample-case" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-20 sm:px-6" aria-labelledby="sample-title">
      <SectionHeading id="sample-title" eyebrow="Try it now" title="Solve a sample case">
        No sign-up needed. Read the case, then pick your diagnosis.
      </SectionHeading>
      <div className="card mt-10 p-5 sm:p-6">
        {!c ? (
          <div className="space-y-3" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-5 animate-pulse rounded-[6px] bg-surface-2" />)}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip font-code text-ds-fg-2">{ageSex(c) || 'Clinical case'}</span>
              {c.counts ? <span className="chip border-transparent bg-info-soft text-info">Real case from Tectum</span> : <span className="chip border-transparent bg-info-soft text-info">Teaching example</span>}
            </div>
            <h3 className="mt-3 font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em]">{c.title}</h3>
            <dl className="mt-4 space-y-3 text-[15px] leading-[23px]">
              {[
                ['Presenting complaint', c.chiefComplaint],
                ['History', c.history],
                ['Examination', c.examination],
                ['Labs / Images', c.investigations],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="ds-eyebrow">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>

            <p className="mt-6 flex items-center gap-1.5 text-[15px] font-semibold"><HelpCircle className="h-[18px] w-[18px] text-link" strokeWidth={1.5} /> What's your diagnosis?</p>
            <div className="mt-3 space-y-2" role="group" aria-label="Diagnosis options">
              {c.options.map((o, i) => {
                const correct = i === c.correctOption;
                return answered ? (
                  <div key={o} className={cn('relative min-h-12 overflow-hidden rounded-[12px] border px-4 py-3', correct ? 'border-success/50' : 'border-line')}>
                    {counts && <div className={cn('absolute inset-y-0 left-0 transition-[width] duration-700 ease-out', correct ? 'bg-success-soft' : 'bg-surface-2')} style={{ width: `${pct(i)}%` }} aria-hidden="true" />}
                    <div className="relative flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px]">
                      <span className={cn('font-semibold', correct && 'text-success')}>{o}</span>
                      {correct && <span className="inline-flex items-center gap-0.5 text-[12px] font-medium text-success"><CircleCheck className="h-4 w-4" strokeWidth={1.75} /> Correct</span>}
                      {picked === i && <span className="rounded-[6px] border border-line-strong bg-surface px-1.5 text-[12px] font-medium">Your answer</span>}
                      {counts && <span className="ds-num ml-auto font-code text-[13px] font-medium">{pct(i)}%</span>}
                    </div>
                  </div>
                ) : (
                  <button key={o} onClick={() => setPicked(i)} className="flex min-h-12 w-full items-center gap-3 rounded-[12px] border border-line-strong bg-surface px-4 py-3 text-left text-[15px] font-medium transition hover:border-link hover:bg-ds-brand-soft active:scale-[0.99]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong font-code text-[12px] font-medium text-ds-fg-3">{String.fromCharCode(65 + i)}</span>
                    {o}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className="animate-sheet mt-5 space-y-3 border-t border-line pt-5" aria-live="polite">
                <p className={cn('text-[15px] font-semibold', picked === c.correctOption ? 'text-success' : 'text-warning')}>
                  {picked === c.correctOption ? 'Spot on!' : 'Not quite, but that is how you learn.'}
                  {counts && total > 1 && <span className="muted font-medium"> {total} answers so far.</span>}
                </p>
                <p><span className="ds-eyebrow block">Diagnosis</span><span className="font-editorial text-[20px] font-medium leading-[26px]">{c.diagnosis}</span></p>
                {c.learningPoint && (
                  <div className="rounded-[12px] bg-warning-soft p-3.5">
                    <p className="ds-eyebrow text-warning!">Why</p>
                    <p className="mt-0.5 text-[15px] leading-[23px]">{c.learningPoint}</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link to="/signup" className="btn-primary min-h-12 px-5">Sign up to solve more <ChevronRight className="h-4 w-4" /></Link>
                  <button className="btn-ghost" onClick={() => setPicked(null)}>Try again</button>
                </div>
              </div>
            )}
            <p className="muted mt-5 flex items-center gap-1.5 text-[12px]"><ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} /> De-identified case · For education only, not medical advice</p>
          </>
        )}
        {isPending && <span className="sr-only">Loading sample case</span>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- how it works
function HowItWorks() {
  const steps = [
    { icon: UserPlus, title: 'Join & pick your year', text: 'Sign up free, choose your year or specialty, and we suggest the Wards to join.' },
    { icon: MessagesSquare, title: 'Solve and discuss cases', text: 'Vote on the diagnosis, see how others answered, and learn from the discussion.' },
    { icon: Target, title: 'Revise and track progress', text: 'Saved cases come back as flashcards right before you’d forget them. Watch your accuracy grow.' },
  ];
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6" aria-labelledby="how-title">
      <SectionHeading id="how-title" eyebrow="How it works" title="Three steps to better clinical reasoning" />
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card relative p-6">
            <span className="ds-num absolute right-5 top-3 font-editorial text-[40px] font-medium leading-[44px] text-ds-fg-4" aria-hidden="true">{i + 1}</span>
            <s.icon className="h-7 w-7 text-link" />
            <h3 className="mt-4 font-editorial text-[20px] font-medium leading-[26px]">{s.title}</h3>
            <p className="muted mt-1.5 text-[15px] leading-[23px]">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- audiences
function Audiences() {
  const cols = [
    {
      id: 'students',
      icon: GraduationCap,
      title: 'For students',
      points: ['Cases matched to your MBBS year', 'Daily goals and streaks that build a habit', 'Flashcards that schedule your revision', 'Exam-style MCQ tips on every case'],
      cta: 'Start learning free',
    },
    {
      id: 'doctors',
      icon: Stethoscope,
      title: 'For doctors',
      points: ['Share interesting cases with the next generation', 'Get verified with your council registration', 'Discuss differentials with peers', 'Find students for research and audits'],
      cta: 'Join as a clinician',
    },
  ];
  return (
    <section className="mx-auto grid max-w-6xl gap-4 px-4 py-20 sm:px-6 md:grid-cols-2">
      {cols.map((c) => (
        <div key={c.id} id={c.id} className="card scroll-mt-24 p-7">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-link"><c.icon className="h-6 w-6" strokeWidth={1.5} /></span>
          <h2 className="mt-4 font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em]">{c.title}</h2>
          <ul className="mt-4 space-y-2.5">
            {c.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-[15px]"><CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-link" strokeWidth={1.5} /> {p}</li>
            ))}
          </ul>
          <Link to="/signup" className="btn-secondary mt-6">{c.cta} <ChevronRight className="h-4 w-4" /></Link>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- testimonials (real quotes only)
function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="voices-title">
      <SectionHeading id="voices-title" eyebrow="From our members" title="What learners say" />
      {TESTIMONIALS.length ? (
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <li key={t.name} className="card p-6">
              <Quote className="h-6 w-6 text-link" aria-hidden="true" />
              <blockquote className="mt-3 font-editorial text-[17px] leading-[26px]">{t.quote}</blockquote>
              <p className="mt-4 text-[13px] font-semibold">{t.name}</p>
              <p className="muted text-[13px]">{t.role}</p>
            </li>
          ))}
        </ul>
      ) : (
        // Placeholder until real members share their words (see client/src/lib/landing.js).
        <div className="mx-auto mt-10 max-w-xl rounded-[20px] border border-dashed border-line-strong p-8 text-center">
          <Quote className="mx-auto h-7 w-7 text-link" aria-hidden="true" />
          <p className="mt-3 font-semibold">We're new, and we'd love to hear from you.</p>
          <p className="muted mt-1 text-[15px]">Real stories from real members will appear here. Tried Tectum? Tell us what you think.</p>
          <a href={`mailto:${SOCIAL.email}?subject=My%20Tectum%20story`} className="btn-secondary mt-4"><Mail className="h-4 w-4" /> Share your story</a>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- FAQ
function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-20 sm:px-6" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions, answered" />
      <div className="mt-10 space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-editorial text-[17px] font-medium">
              {f.q}
              <ChevronDown className="h-5 w-5 shrink-0 text-ds-fg-3 transition-transform group-open:rotate-180" strokeWidth={1.5} aria-hidden="true" />
            </summary>
            <p className="muted px-5 pb-5 text-[15px] leading-[23px]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- final CTA + footer
function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="relative overflow-hidden rounded-[28px] bg-[#0f2a5c] px-6 py-14 text-center text-white">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-[#f97362]/20 blur-3xl" aria-hidden="true" />
        <h2 className="relative font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em] sm:text-[40px] sm:leading-[44px]">Your next case is waiting.</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-[17px] leading-[26px] text-white/85">Join free and solve your first case in under two minutes.</p>
        <Link to="/signup" className="relative mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 text-[17px] font-medium text-[#1d4ed8] transition hover:bg-[#eff6ff] active:scale-[0.98]">
          Join Tectum free <ChevronRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  const socials = Object.entries(SOCIAL).filter(([k, v]) => v && k !== 'email');
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Logo compact />
          <p className="muted mt-3 max-w-sm text-[13px] leading-[18px]">
            Case-based learning for medical students and doctors. <b className="font-semibold text-ink">For educational purposes only, not medical advice.</b>
          </p>
          <p className="muted mt-3 text-[13px] leading-[18px]">
            We process personal data in line with India's Digital Personal Data Protection Act, 2023. Cases must be de-identified before posting.
          </p>
        </div>
        <nav aria-label="Legal">
          <p className="ds-eyebrow">Legal</p>
          <ul className="mt-3 space-y-2 text-[13px]">
            {LEGAL_DOCS.map((d) => (
              <li key={d.slug}><Link to={`/legal/${d.slug}`} className="muted hover:text-ink hover:underline">{d.title}</Link></li>
            ))}
            <li><Link to="/legal/terms#disclaimer" className="muted hover:text-ink hover:underline">Disclaimer</Link></li>
          </ul>
        </nav>
        <div>
          <p className="ds-eyebrow">Contact</p>
          <ul className="mt-3 space-y-2 text-[13px]">
            <li>
              <a href={`mailto:${SOCIAL.email}`} className="muted inline-flex items-center gap-1.5 hover:text-ink hover:underline"><Mail className="h-4 w-4" strokeWidth={1.5} /> {SOCIAL.email}</a>
            </li>
            {socials.map(([k, v]) => (
              <li key={k}>
                <a href={v} target="_blank" rel="noopener noreferrer" className="muted inline-flex items-center gap-1.5 capitalize hover:text-ink hover:underline"><Globe className="h-4 w-4" strokeWidth={1.5} /> {k === 'x' ? 'X (Twitter)' : k}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="muted border-t border-line px-4 py-5 text-center text-[13px]">© {new Date().getFullYear()} Tectum. All rights reserved.</p>
    </footer>
  );
}

/** Public landing page ("/"), shown to logged-out visitors; members are sent to /home. */
export default function Landing() {
  const { sample, isPending } = useSampleCase();
  useEffect(() => {
    document.title = 'Tectum · Learn medicine one real case at a time';
  }, []);
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* animated soft blobs behind the glass */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="blob left-[-10%] top-[-5%] h-[28rem] w-[28rem] bg-[var(--ds-blob-1)]" />
        <div className="blob right-[-8%] top-[10%] h-[24rem] w-[24rem] bg-[var(--ds-blob-2)] [animation-delay:-6s]" />
        <div className="blob left-[30%] top-[45%] h-[26rem] w-[26rem] bg-[var(--ds-blob-3)] [animation-delay:-12s]" />
      </div>
      <a href="#main" className="ds-glass-strong fixed left-3 top-3 z-[80] -translate-y-24 rounded-[12px] px-4 py-2.5 text-[13px] font-semibold transition focus:translate-y-0">Skip to content</a>
      <LandingNav />
      <main id="main">
        <Hero sample={sample} />
        <TrustStrip />
        <FilmSection />
        <Features />
        <SampleCase sample={sample} isPending={isPending} />
        <HowItWorks />
        <Audiences />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
