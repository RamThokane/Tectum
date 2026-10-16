import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, Check, Pin, Layers, CircleCheck, MessageCircle, Hospital, UserPlus, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { PageShell } from '../components/Layout';
import PostCard, { AuthorLine, SpecialtyPill } from '../components/PostCard';
import PostActions from '../components/PostActions';
import InfiniteFeed from '../components/InfiniteFeed';
import SearchSuggest from '../components/SearchSuggest';
import { useCaseOfTheDay } from '../components/StudyPanel';
import { StreakChips, recordReview } from '../components/StudyProgress';
import { FlashcardModal, toFlashcard } from '../components/SwipeDeck';
import { useAdSettings } from '../components/Ads';
import { Chip, EmptyState, Skeleton } from '../components/ui';
import { useWards, useToggleWard } from '../hooks/useWards';
import { useReviewSummary } from '../hooks/useReviews';
import { specialtyMeta, wardOf, WARDS, slugsForCourse } from '../lib/specialties';
import { ageSexLabel } from '../lib/constants';
import { cn, pluralize } from '../lib/format';
import { SpecialtyDot } from '../components/ds/display';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const TABS = [
  { id: 'foryou', label: 'For you', params: {} },
  { id: 'following', label: 'Following', params: { following: true } },
  { id: 'wards', label: 'My Wards', params: { wards: true, sort: 'recent' } },
];

// ---------------------------------------------------------------- pinned items

/** Today's Case of the Day, pinned at the top of the timeline like a post. */
function PinnedCase() {
  const { data, isPending } = useCaseOfTheDay();
  if (isPending) {
    return (
      <div className="space-y-2 px-4 py-4 sm:px-5" aria-hidden="true">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }
  if (!data) return null;
  const cs = data.caseStudy ?? {};
  const ward = wardOf(data);
  const answers = data.commentCount ?? 0;
  return (
    <article className="px-4 pb-2 pt-3 sm:px-5" aria-label="Case of the Day">
      <p className="ds-eyebrow mb-2 flex items-center gap-1.5 pl-14 text-ds-brand-text!">
        <Pin className="h-3.5 w-3.5" strokeWidth={1.75} /> Case of the Day
      </p>
      <AuthorLine user={data.author} date={data.createdAt} size="md" />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {ward && <SpecialtyPill tag={ward} link={false} />}
        {ageSexLabel(cs) && <Chip>{ageSexLabel(cs)}</Chip>}
        {data.solved && <Chip tone="success" icon={CircleCheck}>Solved</Chip>}
      </div>
      <h2 className="mt-2 font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em]">{data.title || cs.chiefComplaint}</h2>
      {data.title && cs.chiefComplaint && <p className="muted mt-1 text-[15px] leading-[23px]">{cs.chiefComplaint}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link to={`/cases/${data._id}`} className="btn-primary min-h-11 px-5">
          {data.solved ? 'Review the case' : 'Solve now'} <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <span className="muted ds-num flex items-center gap-1 text-[13px]">
          <MessageCircle className="h-4 w-4" strokeWidth={1.5} /> {answers ? `${pluralize(answers, 'answer')}` : 'Be the first to answer'}
        </span>
      </div>
      <div className="mt-2">
        <PostActions post={data} />
      </div>
    </article>
  );
}

/** "Your revision · N cards due": one saved case as an inline flashcard, and a Revise button. */
function RevisionItem() {
  const qc = useQueryClient();
  const { data: summary } = useReviewSummary();
  const { data } = useQuery({
    queryKey: ['posts', 'saved', 'flashcards'],
    queryFn: () => api.get('/posts', { params: { bookmarked: true, type: 'case_study', limit: 30 } }).then((r) => r.data.posts),
    staleTime: 5 * 60_000,
  });
  const cards = (data ?? []).map((p) => ({ post: p, card: toFlashcard(p) })).filter((x) => x.card);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [revising, setRevising] = useState(false);
  const due = summary?.due ?? 0;
  if (!cards.length) return null;
  const { card } = cards[index % cards.length];
  const flip = () => {
    if (!flipped) recordReview(qc);
    setFlipped((f) => !f);
  };
  return (
    <section className="px-4 py-3 sm:px-5" aria-label="Your revision">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-link">
          <Layers className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <p className="min-w-0 flex-1 text-[15px]">
          <b className="font-semibold">Your revision</b>
          <span className="muted ds-num"> · {due ? `${pluralize(due, 'card')} due` : 'all caught up'}</span>
        </p>
        {cards.length > 1 && (
          <button onClick={() => { setIndex((i) => i + 1); setFlipped(false); }} className="btn-ghost min-h-10 min-w-10 p-2" aria-label="Another card" title="Another card">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        {due > 0 && (
          <button onClick={() => setRevising(true)} className="btn-secondary min-h-9 px-3 text-[13px]">Revise</button>
        )}
      </div>
      <button
        onClick={flip}
        className={cn('ml-[3.25rem] mt-2 block w-[calc(100%-3.25rem)] rounded-[12px] border p-3.5 text-left transition duration-150 active:scale-[0.99]', flipped ? 'border-success/40 bg-success-soft' : 'border-line bg-surface-2/50 hover:border-line-strong')}
        aria-live="polite"
      >
        <p className="ds-eyebrow">{flipped ? 'Answer' : 'Presenting complaint'}</p>
        <p className="mt-1 font-editorial text-[20px] font-medium leading-[26px]">{flipped ? card.back : card.front}</p>
        <p className="mt-1.5 text-[13px] font-medium text-link">{flipped ? 'Tap to see the question again' : 'Tap to reveal the answer'}</p>
      </button>
      {revising && <FlashcardModal onClose={() => setRevising(false)} />}
    </section>
  );
}

/** Suggests Wards to join: your own specialties first, then your course's Wards. */
function JoinWardsPrompt() {
  const me = useAuthStore((s) => s.user);
  const { data } = useWards();
  const toggle = useToggleWard();
  const mine = (me?.specialtyTags ?? []).filter((t) => WARDS.some((w) => w.slug === t));
  const picks = [...new Set([...mine, ...slugsForCourse(me?.course)])].slice(0, 8);
  const joined = new Set((data ?? []).filter((w) => w.joined).map((w) => w.slug));
  return (
    <div className="p-4 sm:p-5">
      <p className="flex items-center gap-2 font-editorial text-[20px] font-medium"><Hospital className="h-5 w-5 text-link" strokeWidth={1.5} /> Join the Wards you study</p>
      <p className="muted mt-1 text-[15px] leading-[23px]">Each Ward is a subject channel. New cases, pearls and questions from your Wards show up in this tab.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {picks.map((slug) => {
          const m = specialtyMeta(slug);
          const on = joined.has(slug);
          return (
            <button
              key={slug}
              onClick={() => toggle.mutate(slug)}
              disabled={toggle.isPending}
              aria-pressed={on}
              className={cn('chip min-h-10 px-3 text-[13px] transition active:scale-[0.98]', on ? 'border-link bg-ds-brand-soft text-link' : 'bg-surface hover:bg-surface-2')}
            >
              <SpecialtyDot hue={m.hue} /> {m.label}
              {on ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
      <Link to="/wards" className="mt-3 inline-flex min-h-9 items-center gap-0.5 text-[13px] font-medium text-link hover:underline">
        Browse all Wards <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------- page

/**
 * Home: an X-style timeline. A compact greeting with streak / goals chips, then tabs
 * (For you · Following · My Wards) over one list: the pinned Case of the Day, your revision
 * card, then posts (with the Ward they're in, and Follow for people you don't follow yet).
 */
export default function Home() {
  const me = useAuthStore((s) => s.user);
  const first = (me?.name || '').replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '').split(/\s+/)[0];
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0];
  const setTab = (id) => setParams(id === 'foryou' ? {} : { tab: id }, { replace: true });
  const { data: wards } = useWards();
  const hasWards = (wards ?? []).some((w) => w.joined);
  const { data: cotd } = useCaseOfTheDay();
  const { feedEvery } = useAdSettings();

  const pinned = (
    <>
      <PinnedCase />
      <RevisionItem />
    </>
  );

  return (
    <PageShell cards docTitle="Home">
      <div className="space-y-3 pt-1 md:pt-2">
        {/* compact greeting */}
        <header className="flex items-start justify-between gap-3 px-2">
          <div className="min-w-0">
            <p className="ds-eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-1 break-words font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em] sm:text-[40px] sm:leading-[44px] sm:tracking-[-0.02em]">{greeting()}{first && `, ${first}`}</h1>
          </div>
          <StreakChips />
        </header>

        {/* search: tablets only (phones use the top bar's search icon, wide screens the right column) */}
        <div className="hidden md:block xl:hidden">
          <SearchSuggest
            value={q}
            onChange={setQ}
            onSubmit={() => q.trim() && navigate(`/discover?q=${encodeURIComponent(q.trim())}`)}
            placeholder="Search people, cases, pearls, Wards or #tags"
            inputClassName="bg-surface py-3"
          />
        </div>

        {/* timeline tabs, sticky under the top bar */}
        <div role="tablist" aria-label="Timeline" className="ds-glass sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-2 flex rounded-none md:top-2 md:mx-0 md:rounded-[20px]">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab.id === t.id} onClick={() => setTab(t.id)} className={cn('tab flex-1', tab.id === t.id && 'tab-active')}>
              {t.label}
            </button>
          ))}
        </div>

        {tab.id === 'wards' && !hasWards ? (
          <div className="card overflow-clip divide-y divide-line">
            {pinned}
            <JoinWardsPrompt />
          </div>
        ) : (
          <InfiniteFeed
            key={tab.id}
            variant="cards"
            queryKey={['posts', 'home', tab.id]}
            params={tab.params}
            adsEvery={tab.id === 'foryou' ? feedEvery : 0}
            header={pinned}
            renderItem={(post) => {
              if (post._id === cotd?._id) return null; // already pinned at the top
              const ward = wardOf(post);
              return (
                <PostCard
                  post={post}
                  showFollow={tab.id !== 'following'}
                  context={ward && tab.id !== 'foryou' ? <><Hospital className="h-3.5 w-3.5" /> In {specialtyMeta(ward).label} Ward</> : ward ? <><Hospital className="h-3.5 w-3.5" /> {specialtyMeta(ward).label} Ward</> : null}
                />
              );
            }}
            empty={
              tab.id === 'following' ? (
                <EmptyState icon={UserPlus} title="You're not following anyone yet" action={<Link to="/discover?tab=specialists" className="btn-primary"><UserPlus className="h-4 w-4" /> Find people to follow</Link>}>
                  Follow classmates and clinicians to see their posts here.
                </EmptyState>
              ) : (
                <EmptyState icon={Hospital} title="Nothing new here yet">Be the first to share a pearl or a case.</EmptyState>
              )
            }
          />
        )}
      </div>
    </PageShell>
  );
}
