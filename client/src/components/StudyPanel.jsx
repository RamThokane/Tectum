import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, RotateCcw, Stethoscope, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import { SpecialtyPill } from './PostCard';
import { ageSexLabel } from '../lib/constants';
import { wardOf } from '../lib/specialties';
import { cn, pluralize } from '../lib/format';
import StudyStreak, { recordReview } from './StudyProgress';
import { useCaseOfTheDay } from '../hooks/useCaseOfTheDay';

/** Small titled card used by every study widget: line icon + serif title (no coloured tile). */
function Widget({ icon: Icon, title, action, children }) {
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-editorial text-[20px] font-medium leading-[26px]">
          <Icon className="h-[18px] w-[18px] text-ds-fg-3" strokeWidth={1.5} />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- Case of the Day

export { useCaseOfTheDay };

/** Today's case, a quick way into today's teaching. */
export function CaseOfTheDay() {
  const { data } = useCaseOfTheDay();
  if (!data) return null;
  const cs = data.caseStudy ?? {};
  return (
    <Widget icon={Stethoscope} title="Case of the Day">
      <Link to={`/cases/${data._id}`} className="group block">
        <div className="flex flex-wrap items-center gap-1.5">
          <SpecialtyPill tag={wardOf(data) ?? data.tags?.[0]} link={false} />
          {ageSexLabel(cs) && <span className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-code text-[12px]">{ageSexLabel(cs)}</span>}
        </div>
        <p className="mt-2 line-clamp-3 font-editorial text-[17px] font-medium leading-[23px] group-hover:underline">{cs.chiefComplaint || data.title}</p>
        <p className="muted ds-num mt-1 text-[12px]">
          {pluralize(data.commentCount, 'comment')}
          {data.poll?.total ? ` · ${pluralize(data.poll.total, 'vote')}` : ''}
        </p>
        <span className="btn-primary mt-3 w-full py-2 text-[13px]">
          What's your diagnosis? <ChevronRight className="h-4 w-4" />
        </span>
      </Link>
    </Widget>
  );
}

// ---------------------------------------------------------------- Study streak

/** A small streak row; tapping it opens goals, analytics and the 12-week activity map. */
export { StudyStreak };

// ---------------------------------------------------------------- Flashcard

/** Quick-fire revision from your saved cases: presenting complaint on the front, diagnosis on the back. */
export function QuickFlashcard() {
  const { data } = useQuery({
    queryKey: ['posts', 'saved', 'flashcards'],
    queryFn: () => api.get('/posts', { params: { bookmarked: true, type: 'case_study', limit: 30 } }).then((r) => r.data.posts),
    staleTime: 5 * 60_000,
  });
  const cards = (data ?? []).filter((p) => p.caseStudy?.chiefComplaint && p.caseStudy?.diagnosis);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards.length ? cards[index % cards.length] : null;
  const qc = useQueryClient();
  const [revised, setRevised] = useState(() => new Set()); // cards already counted toward today's goal
  const flip = () => {
    setFlipped((f) => !f);
    if (!flipped && card && !revised.has(card._id)) {
      setRevised((s) => new Set(s).add(card._id));
      recordReview(qc);
    }
  };

  const next = () => {
    setFlipped(false);
    setIndex((i) => (cards.length > 1 ? (i + 1 + Math.floor(Math.random() * (cards.length - 1))) % cards.length : i));
  };

  return (
    <Widget
      icon={Layers}
      title="Quick flashcard"
      action={cards.length > 1 && (
        <button onClick={next} className="rounded-full p-1.5 text-ds-fg-3 hover:bg-surface-2 hover:text-ink" title="Another card" aria-label="Another card">
          <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
        </button>
      )}
    >
      {card ? (
        <button
          onClick={flip}
          className={cn(
            'w-full rounded-[12px] border p-3 text-left transition active:scale-[0.99]',
            flipped ? 'border-success/40 bg-success-soft' : 'border-line bg-surface-2/50 hover:border-line-strong'
          )}
          aria-live="polite"
        >
          <p className="ds-eyebrow">{flipped ? 'Diagnosis' : 'Presenting complaint'}</p>
          <p className="mt-1 line-clamp-4 font-editorial text-[17px] font-medium leading-[23px]">
            {flipped ? card.caseStudy.diagnosis : card.caseStudy.chiefComplaint}
          </p>
          <p className="muted mt-2 text-[12px]">{flipped ? 'Tap to see the question again' : 'Tap to reveal the answer'}</p>
        </button>
      ) : (
        <p className="muted text-[13px]">
          Save a few cases (the bookmark icon) and they'll turn into flashcards here.{' '}
          <Link to="/cases" className="font-medium text-link hover:underline">Browse cases</Link>
        </p>
      )}
    </Widget>
  );
}

/** Phones and tablets have no right rail, so the study tools sit in a swipeable strip on the feed. */
export function StudyStrip() {
  return (
    <div className="lg:hidden">
      <p className="ds-eyebrow mb-2 px-1">Today's study</p>
      <div className="no-scrollbar -mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-1 md:mx-0 md:px-0 [&>*]:w-[82%] [&>*]:max-w-sm [&>*]:shrink-0 [&>*]:snap-start">
        <CaseOfTheDay />
        <StudyStreak />
        <QuickFlashcard />
      </div>
    </div>
  );
}

/** The whole study panel, used as the default right rail. */
export default function StudyPanel() {
  return (
    <>
      <CaseOfTheDay />
      <StudyStreak />
      <QuickFlashcard />
    </>
  );
}
