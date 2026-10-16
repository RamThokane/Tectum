import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, Check, Sparkles, Hospital, UserPlus } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { PageShell, WhoToFollowStrip } from '../components/Layout';
import PostCard from '../components/PostCard';
import InfiniteFeed from '../components/InfiniteFeed';
import SearchSuggest from '../components/SearchSuggest';
import { useCaseOfTheDay } from '../hooks/useCaseOfTheDay';
import { StreakChips } from '../components/StudyProgress';
import { useAdSettings } from '../components/Ads';
import { EmptyState, Skeleton } from '../components/ui';
import { useWards, useToggleWard } from '../hooks/useWards';
import { specialtyMeta, wardOf, WARDS, slugsForCourse } from '../lib/specialties';
import { cn } from '../lib/format';
import { SpecialtyDot } from '../components/ds/display';
import { AppShortcutPopup } from '../components/AppShortcut';

/**
 * Home's greeting: one message per day, in turn, with the member's first name in place of {name}
 * (the ", {name}" part is dropped when there's no name). Edit freely; any number of lines works.
 */
const DAILY_GREETINGS = [
  "Ready for today's case, {name}?",
  'One case a day, {name}.',
  'Think like a clinician, {name}.',
  'Keep going, {name}.',
  'Stay curious, {name}.',
];
const dailyGreeting = (name) => {
  const now = new Date();
  const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000); // day of the year
  const line = DAILY_GREETINGS[day % DAILY_GREETINGS.length];
  return name ? line.replace('{name}', name) : line.replace(/,? \{name\}/, '');
};

const TABS = [
  // Every post, newest first (no blue-tick boost reordering here).
  { id: 'foryou', label: 'For you', params: { sort: 'recent' } },
  { id: 'following', label: 'Following', params: { following: true } },
  { id: 'wards', label: 'My Wards', params: { wards: true, sort: 'recent' } },
];

// ---------------------------------------------------------------- pinned items

/**
 * Today's Case of the Day at the top of the timeline: just the label and a way in. The case
 * itself (and its revision as a flashcard) is on the case page.
 */
function PinnedCase() {
  const { data, isPending } = useCaseOfTheDay();
  if (isPending) {
    return (
      <div className="space-y-3 px-4 py-4 sm:px-5" aria-hidden="true">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-11 w-44 rounded-full" />
      </div>
    );
  }
  if (!data) return null;
  return (
    <article className="px-4 py-4 sm:px-5" aria-label="Case of the Day">
      <p className="ds-eyebrow flex items-center gap-1.5 text-ds-brand-text!">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} /> Case of the Day
      </p>
      <Link to={`/cases/${data._id}`} className="btn-primary mt-3 min-h-11 px-5">
        Review the case <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
      </Link>
    </article>
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
 * (For you · Following · My Wards) over one list: the Case of the Day, then posts (with the Ward they're in, and Follow for people you don't follow yet).
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

  const pinned = <PinnedCase />;

  return (
    <PageShell cards docTitle="Home">
      <AppShortcutPopup />
      <div className="space-y-3 pt-1 md:pt-2">
        {/* compact greeting */}
        <header className="flex items-start justify-between gap-3 px-2">
          <div className="min-w-0">
            <p className="ds-eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-1 break-words font-editorial text-[20px] font-medium leading-[26px] tracking-[-0.01em] sm:text-[24px] sm:leading-[30px]">{dailyGreeting(first)}</h1>
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

        {/* phones / tablets: Who to follow as a sideways row (wide screens have it in the right column) */}
        {tab.id === 'foryou' && <WhoToFollowStrip />}

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
