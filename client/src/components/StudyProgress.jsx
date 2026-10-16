import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { StreakFlame } from './ds/icons';
import { Check, Stethoscope, Layers, PenLine, Trophy, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';
import { Modal } from './ui';
import { cn, pluralize } from '../lib/format';
import { consistency, weekChange, dayInZone } from '../lib/streakMath';
import { useReviewSummary } from '../hooks/useReviews';

const TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
})();

/** My study activity per day (cases solved, flashcards, posts, answers) and streaks. */
export function useStudyActivity() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get('/users/me/activity', { params: { tz: TZ } }).then((r) => r.data),
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000, // refreshed explicitly after solving, revising or posting
  });
}

/** Record flashcards revised (fire and forget) and refresh the progress card. */
export function recordReview(qc, count = 1) {
  api
    .post('/users/me/activity/review', { count })
    .then(() => qc.invalidateQueries({ queryKey: ['activity'] }))
    .catch(() => {});
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EMPTY = { solved: 0, reviewed: 0, posts: 0, cases: 0, pearls: 0, answers: 0 };
const score = (d) => (d ? d.solved + d.posts + d.answers + Math.ceil(d.reviewed / 5) : 0);
const HEAT = ['bg-surface-2', 'bg-ds-accent/25', 'bg-ds-accent/55', 'bg-ds-accent'];
const heat = (d) => HEAT[Math.min(3, score(d) === 0 ? 0 : score(d) <= 1 ? 1 : score(d) <= 3 ? 2 : 3)];

/** "2026-09-26" moved by n days. */
const shift = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (day) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const niceDate = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "2 cases solved · 5 flashcards · 1 answer" for one day. */
function describe(d) {
  if (!score(d)) return 'Nothing yet';
  const parts = [];
  const n = (x, one, many) => x && parts.push(`${x} ${x === 1 ? one : many}`);
  n(d.solved, 'case solved', 'cases solved');
  n(d.reviewed, 'flashcard', 'flashcards');
  n(d.posts, 'post shared', 'posts shared');
  n(d.answers, 'answer', 'answers');
  return parts.join(' · ');
}

/** Today's three small goals: each one is a tap away. */
const GOALS = [
  { id: 'solve', label: 'Solve a case', icon: Stethoscope, target: 1, value: (d) => d.solved, to: '/cases?unsolved=1' },
  { id: 'review', label: 'Revise 5 flashcards', icon: Layers, target: 5, value: (d) => d.reviewed, to: '/notebook' },
  { id: 'share', label: 'Share or answer a post', icon: PenLine, target: 1, value: (d) => d.posts + d.answers, compose: true },
];

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Counts up from 0 to `target` when shown. */
function useCountUp(target, ms = 700) {
  const [n, setN] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (reducedMotion()) return setN(target);
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      setN(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

/** Everything the card and the analytics need, worked out from the per-day counts. */
function useStats(data) {
  // The member's daily goal (set during onboarding) is the "Solve a case" target.
  const dailyGoal = useAuthStore((s) => s.user?.preferences?.dailyGoal) || 1;
  const joinedAt = useAuthStore((s) => s.user?.createdAt);
  // With nothing saved there's nothing to revise, so that goal points to saving a card first.
  const { data: deck } = useReviewSummary();
  const emptyNotebook = deck?.total === 0;
  return useMemo(() => {
    if (!data) return null;
    const { today, streak, best, days } = data;
    const t = days[today] ?? EMPTY;
    const goals = GOALS.map((g) => {
      if (g.id === 'solve' && dailyGoal > 1) return { ...g, target: dailyGoal, label: `Solve ${dailyGoal} cases` };
      if (g.id === 'review' && emptyNotebook) return { ...g, hint: 'Your Notebook is empty: save a case or pearl first', to: '/cases' };
      return g;
    }).map((g) => ({
      ...g,
      have: Math.min(g.target, g.value(t)),
      done: g.value(t) >= g.target,
    }));
    const doneCount = goals.filter((g) => g.done).length;

    const range = (from, n) => Array.from({ length: n }, (_, i) => shift(from, i));
    const sumPoints = (keys) => keys.reduce((s, k) => s + score(days[k]), 0);

    // Last 30 days, oldest first.
    const last30 = range(shift(today, -29), 30);
    const active30 = last30.filter((k) => score(days[k])).length;
    const mix = last30.reduce(
      (acc, k) => {
        const d = days[k];
        if (d) {
          acc.solved += d.solved;
          acc.reviewed += d.reviewed;
          acc.posts += d.posts;
          acc.answers += d.answers;
        }
        return acc;
      },
      { solved: 0, reviewed: 0, posts: 0, answers: 0 }
    );

    // This week so far vs the same days last week (a fair comparison mid-week).
    const monday = shift(today, -weekdayOf(today));
    const thisWeek = sumPoints(range(monday, weekdayOf(today) + 1));
    const lastWeek = sumPoints(range(shift(monday, -7), weekdayOf(today) + 1));

    // 12 weeks, Monday-first columns, for the heatmap and the best weekday.
    const heatStart = shift(monday, -7 * 11);
    const weeks = Array.from({ length: 12 }, (_, w) => range(shift(heatStart, w * 7), 7));
    const byWeekday = Array(7).fill(0);
    weeks.flat().forEach((k) => k <= today && (byWeekday[weekdayOf(k)] += score(days[k])));
    const bestWeekday = Math.max(...byWeekday) > 0 ? WEEKDAY_NAMES[byWeekday.indexOf(Math.max(...byWeekday))] : null;

    const activeYear = Object.keys(days).filter((k) => score(days[k])).length;

    const joinedDay = joinedAt ? dayInZone(joinedAt, TZ) : null;
    return { today, streak, best, days, t, goals, doneCount, last30, active30, mix, thisWeek, lastWeek, weeks, bestWeekday, activeYear, joinedDay };
  }, [data, dailyGoal, emptyNotebook, joinedAt]);
}

/** Small ring showing today's goals done (0-3). */
function GoalRing({ done, total = 3, size = 30 }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className="stroke-surface-2" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - done / total)}
        className={cn('streak-ring', done === total ? 'stroke-ds-success' : 'stroke-ds-accent')}
        style={{ '--ring-len': c }}
      />
    </svg>
  );
}

/**
 * Study streak as a small icon row: an animated flame with the streak, and a ring for today's
 * goals. Tap it for the full progress: goals, analytics and the 12-week activity map.
 */
export default function StudyProgress() {
  const { data, isPending } = useStudyActivity();
  const s = useStats(data);
  const [open, setOpen] = useState(false);

  if (isPending || !s) {
    return <section className="card h-[60px] animate-pulse" aria-label="Loading your study streak" />;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="card group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2"
        aria-label={`Study streak: ${pluralize(s.streak, 'day')}, ${s.doneCount} of 3 goals done today. Open details`}
      >
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', s.streak ? 'bg-ds-accent-soft' : 'bg-surface-2 text-ds-fg-3')}>
          <StreakFlame lit={Boolean(s.streak)} className={cn(s.streak && 'streak-flicker')} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="ds-num block text-[15px] font-semibold">
            {s.streak ? (
              <>{pluralize(s.streak, 'day')} <span className="font-normal text-ds-fg-3">streak</span></>
            ) : (
              'Start a streak'
            )}
          </span>
          <span className="muted block text-[12px]">{s.doneCount ? `${s.doneCount}/3 goals today` : "Tap to see today's goals"}</span>
        </span>
        <GoalRing done={s.doneCount} />
        <ChevronRight className="h-4 w-4 shrink-0 text-ds-fg-3 transition group-hover:translate-x-0.5" strokeWidth={1.5} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Study streak" size="max-w-xl">
        <StreakDetails s={s} onGo={() => setOpen(false)} />
      </Modal>
    </>
  );
}

/**
 * Compact version for the Home greeting row: a flame + streak chip and a "1/3 goals" chip.
 * Either one opens the full study-streak details.
 */
export function StreakChips() {
  const { data } = useStudyActivity();
  const s = useStats(data);
  const [open, setOpen] = useState(false);
  if (!s) return <span className="ds-shimmer h-9 w-32 rounded-full" aria-hidden="true" />;
  const chip = 'chip ds-num min-h-9 px-3 text-[13px] font-medium transition-colors active:scale-[0.98]';
  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => setOpen(true)}
          className={cn(chip, s.streak ? 'border-transparent bg-ds-accent-soft text-ds-accent-text' : 'bg-surface text-ds-fg-3 hover:bg-surface-2')}
          aria-label={s.streak ? `${s.streak}-day study streak. Open details` : 'No streak yet. Open study goals'}
        >
          <StreakFlame size={16} lit={Boolean(s.streak)} /> {s.streak}
        </button>
        <button onClick={() => setOpen(true)} className={cn(chip, 'bg-surface text-ink hover:bg-surface-2')} aria-label={`${s.doneCount} of 3 goals done today. Open details`}>
          {s.doneCount}/3 goals
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Study streak" size="max-w-xl">
        <StreakDetails s={s} onGo={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function StreakDetails({ s, onGo }) {
  const navigate = useNavigate();
  const openComposer = useUIStore((st) => st.openComposer);
  const [picked, setPicked] = useState(null);
  const count = useCountUp(s.streak);

  const { today, streak, best, days, t, goals, doneCount } = s;
  const next = goals.find((g) => !g.done);
  const activeToday = score(t) > 0;
  const message =
    doneCount === 3
      ? "All of today's goals done. Brilliant work, see you tomorrow!"
      : !activeToday && streak > 0
        ? `Do one thing today to keep your ${streak}-day streak alive.`
        : !activeToday
          ? 'Start a streak today: solve one case, it takes two minutes.'
          : `${doneCount} of 3 done. Next: ${next.label.toLowerCase()}.`;

  const go = (g) => {
    onGo();
    if (g.compose) openComposer('text', { kind: 'pearl' });
    else navigate(g.to);
  };

  return (
    <div className="space-y-6 p-5">
      {/* hero */}
      <div className="flex items-center gap-4">
        <span className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-full', streak ? 'bg-ds-accent-soft' : 'bg-surface-2 text-ds-fg-3')}>
          <StreakFlame size={36} lit={Boolean(streak)} className={cn(streak && 'streak-flicker')} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5">
            <span className="ds-num font-editorial text-[40px] font-medium leading-[44px] tracking-[-0.02em]">{count}</span>
            <span className="muted text-[13px]">day{streak !== 1 && 's'} in a row</span>
          </p>
          <p className="text-[13px] font-semibold">{message}</p>
        </div>
        <span className="muted flex shrink-0 items-center gap-1 self-start text-[12px] font-semibold" title="Your longest streak this year">
          <Trophy className="h-3.5 w-3.5 text-ds-accent-text" strokeWidth={1.5} /> Best {best}
        </span>
      </div>

      {/* today's goals */}
      <section>
        <SectionTitle right={`${doneCount}/3`}>Today's goals</SectionTitle>
        <ul className="space-y-1.5">
          {goals.map((g, i) => (
            <li key={g.id} className="streak-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <button
                onClick={() => go(g)}
                className={cn(
                  'group flex w-full items-center gap-2.5 rounded-[12px] border px-2.5 py-2 text-left transition',
                  g.done ? 'border-success/40 bg-success-soft' : 'border-line hover:border-ink hover:bg-surface-2'
                )}
              >
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', g.done ? 'bg-success text-white' : 'bg-surface-2 text-ds-fg-3')}>
                  {g.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <g.icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13px] font-semibold', g.done && 'text-success')}>{g.label}</span>
                  {g.hint && !g.done && <span className="muted block text-[12px]">{g.hint}</span>}
                  {g.target > 1 && !g.done && (
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <span className="streak-fill block h-full origin-left rounded-full bg-ds-accent" style={{ width: `${(g.have / g.target) * 100}%` }} />
                    </span>
                  )}
                </span>
                <span className="muted shrink-0 text-[12px] font-semibold ds-num">{g.have}/{g.target}</span>
                {!g.done && <ChevronRight className="h-4 w-4 shrink-0 text-ds-fg-3 transition group-hover:translate-x-0.5" />}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Analytics s={s} />

      {/* 12-week activity map */}
      <section>
        <SectionTitle right={`${s.activeYear} active day${s.activeYear !== 1 ? 's' : ''} this year`}>Last 12 weeks</SectionTitle>
        <div className="flex gap-2">
          <div className="grid grid-rows-7 gap-[3px] pt-0" aria-hidden="true">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="muted flex h-[18px] items-center text-[12px] font-semibold">{i % 2 === 0 ? d : ''}</span>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-12 gap-[3px]" role="grid" aria-label="Activity over the last 12 weeks">
            {s.weeks.map((week, w) => (
              <div key={w} className="grid grid-rows-7 gap-[3px]">
                {week.map((k, i) => {
                  const future = k > today;
                  const d = days[k];
                  return (
                    <button
                      key={k}
                      disabled={future}
                      onClick={() => setPicked(k)}
                      title={`${niceDate(k)}: ${describe(d)}`}
                      aria-label={`${niceDate(k)}: ${describe(d)}`}
                      style={{ animationDelay: `${(w * 7 + i) * 6}ms` }}
                      className={cn(
                        'streak-pop h-[18px] rounded-[4px]',
                        future ? 'bg-transparent' : heat(d),
                        (picked ?? today) === k && !future && 'ring-2 ring-ink ring-offset-1 ring-offset-surface'
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="rounded-[6px] bg-surface-2 px-2.5 py-1.5 text-[12px]">
            <span className="font-semibold">{(picked ?? today) === today ? 'Today' : niceDate(picked)}:</span>{' '}
            <span className="muted">{describe(days[picked ?? today])}</span>
          </p>
          <span className="muted flex items-center gap-1 text-[12px]" aria-hidden="true">
            Less {HEAT.map((h) => <span key={h} className={cn('h-2.5 w-2.5 rounded-[3px]', h)} />)} More
          </span>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <p className="mb-2 flex items-center justify-between gap-2 text-[12px] font-semibold uppercase tracking-wide text-ds-fg-3">
      {children}
      {right && <span className="font-semibold normal-case tracking-normal">{right}</span>}
    </p>
  );
}

/** Numbers and charts: consistency, week-on-week change, best weekday, 30-day chart, what you spent time on. */
function Analytics({ s }) {
  const [hover, setHover] = useState(null);
  const { days, today, last30, active30, thisWeek, lastWeek, bestWeekday, mix, joinedDay } = s;
  // Newer accounts are measured over the days since they joined, not a full 30.
  const steady = consistency(active30, joinedDay, today);
  const change = weekChange(thisWeek, lastWeek);
  const Trend = change.direction > 0 ? TrendingUp : change.direction < 0 ? TrendingDown : Minus;
  const points = last30.map((k) => score(days[k]));
  const max = Math.max(4, ...points);
  const avg = active30 ? points.reduce((a, b) => a + b, 0) / active30 : 0;
  const shown = hover ?? last30.length - 1;

  const mixRows = [
    ['Cases solved', mix.solved],
    ['Flashcards', mix.reviewed],
    ['Posts shared', mix.posts],
    ['Answers', mix.answers],
  ];
  const mixMax = Math.max(1, ...mixRows.map((r) => r[1]));

  return (
    <section className="space-y-4">
      <SectionTitle>Analytics</SectionTitle>

      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Consistency" value={`${steady.pct}%`} hint={`${steady.active} of last ${pluralize(steady.window, 'day')}`}>
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-2">
            <span className="streak-fill block h-full origin-left rounded-full bg-ds-accent" style={{ width: `${steady.pct}%` }} />
          </span>
        </Tile>
        <Tile
          label="vs last week"
          value={
            <span className="inline-flex items-center gap-1">
              <Trend className={cn('h-4 w-4', change.direction > 0 ? 'text-success' : change.direction < 0 ? 'text-danger' : 'text-ds-fg-3')} aria-hidden="true" />
              {change.label}
            </span>
          }
          hint={`${thisWeek} pts this week, ${lastWeek} last`}
        />
        <Tile label="Best day" value={bestWeekday ? bestWeekday.slice(0, 3) : '—'} hint={bestWeekday ? `You study most on ${bestWeekday}s` : 'Not enough data yet'} />
        <Tile label="Avg / active day" value={avg.toFixed(1)} hint="study points" />
      </div>

      {/* 30-day bar chart */}
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
          <span className="font-semibold">Study points, last 30 days</span>
          <span className="muted ds-num">
            <span className="font-semibold text-ink">{niceDate(last30[shown])}</span> · {points[shown]} pt{points[shown] !== 1 && 's'}
          </span>
        </div>
        <div className="relative" onMouseLeave={() => setHover(null)}>
          {/* gridlines */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {[0, 1, 2].map((i) => <span key={i} className="border-t border-line/70" />)}
          </div>
          <div className="relative flex h-24 items-end gap-[2px]" role="img" aria-label={`Study points per day for the last 30 days, ${active30} active days`}>
            {points.map((p, i) => (
              <button
                key={last30[i]}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                aria-label={`${niceDate(last30[i])}: ${p} points. ${describe(days[last30[i]])}`}
                className="group flex h-full flex-1 items-end"
              >
                <span
                  className={cn(
                    'streak-grow block w-full origin-bottom rounded-t-[4px] transition-colors',
                    p === 0
                      ? 'bg-surface-2'
                      : shown === i
                        ? 'bg-ds-accent'
                        : last30[i] === today
                          ? 'bg-ds-accent/80'
                          : 'bg-ds-accent/45'
                  )}
                  style={{ height: p ? `${Math.max(8, (p / max) * 100)}%` : '3px', animationDelay: `${i * 18}ms` }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="muted mt-1 flex justify-between text-[12px]">
          <span>{niceDate(last30[0])}</span>
          <span>Today</span>
        </div>
      </div>

      {/* what you spent time on */}
      <div>
        <p className="mb-1.5 text-[12px] font-semibold">What you did, last 30 days</p>
        <ul className="space-y-1.5">
          {mixRows.map(([label, n], i) => (
            <li key={label} className="flex items-center gap-2 text-[12px]">
              <span className="w-24 shrink-0 text-ds-fg-2">{label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="streak-fill block h-full origin-left rounded-full bg-ink/80"
                  style={{ width: `${(n / mixMax) * 100}%`, animationDelay: `${i * 80}ms` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-semibold ds-num">{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Tile({ label, value, hint, children }) {
  return (
    <div className="streak-rise rounded-[12px] border border-line px-3 py-2">
      <p className="muted text-[12px] font-semibold">{label}</p>
      <p className="text-[17px] font-semibold ds-num">{value}</p>
      <p className="muted text-[12px] leading-tight">{hint}</p>
      {children}
    </div>
  );
}
