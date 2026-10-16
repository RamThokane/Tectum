import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SearchSuggest from '../components/SearchSuggest';
import { SearchX, Bookmark, Stethoscope, FileText, Library, HeartPulse, Brain, Microscope, Baby, Pill, Activity } from 'lucide-react';
import { api } from '../api/client';
import { useTogglePost } from '../hooks/usePosts';
import { PageShell, RailCard, ConnectWithExperts, useTrends } from '../components/Layout';
import { usePostFeed, useAutoLoadMore, FEED_SURFACE } from '../components/InfiniteFeed';
import PostCard, { postTitle, postCategory } from '../components/PostCard';
import UserRow from '../components/UserRow';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../components/ui';
import { prettyTag, userTitle } from '../lib/constants';
import { cn, timeAgo, stripMentions, pluralize } from '../lib/format';

const REPO_TABS = [
  { id: 'all', label: 'All results', params: {} },
  { id: 'cases', label: 'Case Studies', params: { type: 'case_study' } },
  { id: 'specialists', label: 'Specialists' },
];

/** Search box pinned at the top of the column (X's Explore). */
function SearchBar({ value, onChange, onSubmit }) {
  return (
    <div className="px-4 py-2">
      <SearchSuggest
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder="Search cases, posts, #tags or people"
        inputClassName="bg-surface-2 focus:bg-white"
      />
    </div>
  );
}

const SectionTitle = ({ children, action }) => (
  <div className="flex items-center justify-between px-4 pb-1 pt-3">
    <h2 className="font-editorial font-medium text-[20px]">{children}</h2>
    {action}
  </div>
);

/** Numbered list of the busiest tags, like X's "Trending" list. */
function TrendingTopics() {
  const { data, isPending } = useTrends();
  if (isPending || !data?.length) return null;
  return (
    <section className="border-b border-line pb-4">
      <SectionTitle>Trending Topics</SectionTitle>
      <div className="grid grid-cols-2 gap-3 px-4 pt-2 sm:grid-cols-3">
        {data.slice(0, 6).map((t, i) => {
          const art = TOPIC_ART[i % TOPIC_ART.length];
          return (
            <Link
              key={t.tag}
              to={`/discover?q=${encodeURIComponent('#' + t.tag)}`}
              className={cn(
                // flat tile: a large faint line icon, the topic in the serif, quiet numbers
                'card card-hover group relative flex h-32 flex-col justify-end overflow-hidden p-3.5',
                art.bg
              )}
            >
              <art.icon className="absolute right-3 top-3 h-12 w-12 text-ds-fg-4 transition group-hover:scale-110 group-hover:text-link" strokeWidth={1.25} />
              <p className="font-editorial text-[17px] font-medium capitalize leading-[23px]">{prettyTag(t.tag)}</p>
              <p className="ds-num text-[12px] text-ds-fg-3">
                {pluralize(t.posts, 'post')} · {t.interactions} interactions
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// One line icon per tile, in trending order (heart, brain, microscope, baby, pill, pulse); no colour fills.
const TOPIC_ART = [
  { icon: HeartPulse, bg: '' },
  { icon: Brain, bg: '' },
  { icon: Microscope, bg: '' },
  { icon: Baby, bg: '' },
  { icon: Pill, bg: '' },
  { icon: Activity, bg: '' },
];

function RepoRow({ post }) {
  const toggle = useTogglePost();
  return (
    <li className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="muted text-[13px] capitalize">
          {post.type === 'case_study' ? 'Case study' : post.type === 'notes' ? 'Notes' : 'Discussion'} · {postCategory(post)} · {timeAgo(post.createdAt)}
        </p>
        <Link to={`/post/${post._id}`} className="mt-0.5 block text-[15px] font-semibold leading-snug hover:underline">
          {postTitle(post) || stripMentions(post.content || '').slice(0, 120)}
        </Link>
        <p className="muted mt-0.5 text-[13px]">
          {post.author?.name} · {userTitle(post.author)}
        </p>
      </div>
      <button
        onClick={() => toggle.mutate({ id: post._id, action: 'bookmark' })}
        className={cn('h-fit rounded-full p-2 transition', post.bookmarked ? 'text-link' : 'text-ds-fg-3 hover:bg-link/10 hover:text-link')}
        aria-label={post.bookmarked ? 'Remove from saved' : 'Save'}
        aria-pressed={post.bookmarked}
      >
        <Bookmark className={cn('h-5 w-5', post.bookmarked && 'fill-current')} />
      </button>
    </li>
  );
}

function Specialists() {
  const { data, isPending } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.get('/users/suggestions').then((r) => r.data.users),
  });
  if (isPending) return <PageLoader />;
  if (!data?.length) return <EmptyState title="No specialists to suggest yet" />;
  return <div className="py-2">{data.map((u) => <UserRow key={u._id} user={u} showBio showStats />)}</div>;
}

function Repository({ initialTab }) {
  const [tab, setTab] = useState(() => (REPO_TABS.some((t) => t.id === initialTab) ? initialTab : 'all'));
  const current = REPO_TABS.find((t) => t.id === tab);
  const query = usePostFeed({
    queryKey: ['posts', 'repository', tab],
    params: { ...current.params, sort: 'recent' },
    enabled: tab !== 'specialists',
  });
  const sentinel = useAutoLoadMore(query);
  const posts = query.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <section id="repository" className="scroll-mt-24">
      <SectionTitle>Latest from Repository</SectionTitle>
      <div>
        <div role="tablist" className="no-scrollbar flex overflow-x-auto border-b border-line">
          {REPO_TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('tab flex-1', tab === t.id && 'tab-active')}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'specialists' ? (
          <Specialists />
        ) : query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : posts.length === 0 ? (
          <EmptyState icon={Library} title="Nothing here yet" />
        ) : (
          <ul>{posts.map((p) => <RepoRow key={p._id} post={p} />)}</ul>
        )}
        <div ref={sentinel} className="flex justify-center">
          {query.isFetchingNextPage && <div className="py-4"><Spinner /></div>}
        </div>
      </div>
    </section>
  );
}

function SearchResults({ q }) {
  const [tab, setTab] = useState('top');
  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get('/search', { params: { q } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  if (isError) return <div className="card"><ErrorState error={error} onRetry={refetch} /></div>;
  if (!data) return <PageLoader />;
  const nothing = !data.users.length && !data.posts.length && !data.tags.length;
  if (nothing) {
    return (
      <div className="card">
        <EmptyState icon={SearchX} title={`No results for "${q}"`}>Try a different spelling, a broader term, or a specialty tag.</EmptyState>
      </div>
    );
  }

  return (
    <div className={cn(isFetching && 'opacity-60 transition-opacity')}>
      <div role="tablist" className="flex border-b border-line">
        {['top', 'people', 'posts'].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('tab flex-1 capitalize', tab === t && 'tab-active')}>
            {t === 'top' ? 'Top' : t}
          </button>
        ))}
      </div>
      {tab === 'top' && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line px-4 py-3">
          {data.tags.map((t) => (
            <Link key={t.tag} to={`/discover?q=${encodeURIComponent('#' + t.tag)}`} className="text-[15px] capitalize text-link hover:underline">
              #{prettyTag(t.tag)} <span className="muted text-[13px]">{t.count}</span>
            </Link>
          ))}
        </div>
      )}
      {(tab === 'top' || tab === 'people') && data.users.length > 0 && (
        <div className="border-b border-line">
          {(tab === 'top' ? data.users.slice(0, 3) : data.users).map((u) => <UserRow key={u._id} user={u} showBio={tab === 'people'} />)}
        </div>
      )}
      {(tab === 'top' || tab === 'posts') && data.posts.length > 0 && (
        <div className={FEED_SURFACE}>
          {data.posts.map((p) => <PostCard key={p._id} post={p} />)}
        </div>
      )}
      {tab === 'people' && !data.users.length && <div className="card"><EmptyState title="No people match" /></div>}
      {tab === 'posts' && !data.posts.length && <div className="card"><EmptyState title="No posts match" /></div>}
    </div>
  );
}

function ActiveDiscussions() {
  const { data } = useQuery({
    queryKey: ['posts', 'discussed'],
    queryFn: () => api.get('/posts', { params: { sort: 'discussed', limit: 4 } }).then((r) => r.data.posts),
  });
  const items = (data ?? []).filter((p) => p.commentCount > 0);
  if (!items.length) return null;
  return (
    <RailCard title="Active discussions">
      <ul className="space-y-3">
        {items.map((p) => (
          <li key={p._id}>
            <Link to={`/post/${p._id}#comments`} className="group block">
              <p className="line-clamp-2 text-[15px] font-semibold leading-snug group-hover:underline">{postTitle(p) || stripMentions(p.content)}</p>
              <p className="muted mt-0.5 text-[13px]">{pluralize(p.commentCount, 'comment')} · {timeAgo(p.createdAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

function SavedResources() {
  const { data } = useQuery({
    queryKey: ['posts', 'saved', 'rail'],
    queryFn: () => api.get('/posts', { params: { bookmarked: true, limit: 3 } }).then((r) => r.data.posts),
  });
  if (!data?.length) return null;
  return (
    <RailCard title="Saved" action={<Link to="/notebook" className="text-[15px] text-link hover:underline">View all</Link>}>
      <ul className="space-y-2.5">
        {data.map((p) => (
          <li key={p._id} className="flex items-start gap-2">
            {p.type === 'notes' ? <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ds-fg-3" /> : <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-ds-fg-3" />}
            <Link to={`/post/${p._id}`} className="line-clamp-2 text-[13px] hover:underline">{postTitle(p) || stripMentions(p.content)}</Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

export default function Discovery() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  // Arriving via "Find people to follow" (?tab=specialists) scrolls to that list.
  useEffect(() => {
    if (params.get('tab') === 'specialists') {
      setTimeout(() => document.getElementById('repository')?.scrollIntoView({ behavior: 'smooth' }), 300);
    }
  }, [params]);

  const search = () => {
    const next = new URLSearchParams();
    if (draft.trim()) next.set('q', draft.trim());
    setParams(next);
  };

  const searching = q.replace(/^#/, '').length >= 2;

  return (
    <PageShell
      bare
      docTitle={q ? `Search: ${q}` : 'Search'}
      tabs={<SearchBar value={draft} onChange={setDraft} onSubmit={search} />}
      rail={
        <>
          <ActiveDiscussions />
          <ConnectWithExperts />
          <SavedResources />
        </>
      }
    >
      <div>
        {searching ? (
          <SearchResults q={q} />
        ) : (
          <>
            <TrendingTopics />
            <Repository key={params.get('tab') || 'all'} initialTab={params.get('tab')} />
          </>
        )}
      </div>
    </PageShell>
  );
}
