import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, FileText, Lightbulb, Stethoscope, MessagesSquare, Trophy, Hospital, ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { PageShell } from '../components/Layout';
import PearlGrid, { PearlTile } from '../components/PearlGrid';
import PostModal from '../components/PostModal';
import InfiniteFeed from '../components/InfiniteFeed';
import Avatar from '../components/Avatar';
import { Tick } from '../components/VerificationBadge';
import { userTitle } from '../lib/constants';
import { FollowButton } from '../components/UserRow';
import { SwipePearlsButton } from '../components/SwipeDeck';
import { EmptyState, PageLoader } from '../components/ui';
import NotFoundState from '../components/NotFoundState';
import { JoinWardButton } from './Wards';
import { useVisitWard } from '../hooks/useWards';
import { specialtyMeta, isWard, WARD_GROUPS } from '../lib/specialties';
import { cn, pluralize } from '../lib/format';
import { SpecialtyDot } from '../components/ds/display';

const TABS = [
  { id: 'pearls', label: 'Pearls', icon: Lightbulb },
  { id: 'cases', label: 'Cases', icon: Stethoscope },
  { id: 'discussions', label: 'Discussions', short: 'Q&A', icon: MessagesSquare },
  { id: 'contributors', label: 'Top contributors', short: 'Top', icon: Trophy },
];

/** "12 cases · 3 posts · 84 likes" (parts that are 0 are left out, likes always shown). */
const contributionLine = ({ cases, posts, likes }) =>
  [cases ? pluralize(cases, 'case') : null, posts ? pluralize(posts, 'post') : null, pluralize(likes, 'like')].filter(Boolean).join(' · ');

function Contributors({ list, windowDays = 30 }) {
  const me = useAuthStore((s) => s.user);
  if (!list?.length) {
    return <div className="card"><EmptyState icon={Trophy} title="No contributors yet">Share the first post in this Ward and you'll be at the top.</EmptyState></div>;
  }
  return (
    <div className="card overflow-clip">
      <p className="border-b border-line px-4 py-2.5 text-[13px] text-ds-fg-3">Most active in the last {windowDays} days: posts and cases shared, and the likes they got.</p>
      <ol className="divide-y divide-line">
        {list.map((row, i) => {
          const { user } = row;
          return (
            <li key={user._id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn('ds-num w-6 shrink-0 text-center font-code text-[15px] font-medium', i < 3 ? 'text-ds-accent-text' : 'text-ds-fg-3')}>{i + 1}</span>
              <Link to={`/profile/${user._id}`} className="shrink-0" aria-label={`${user.name}'s profile`}><Avatar user={user} size="md" /></Link>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[15px]">
                  <Link to={`/profile/${user._id}`} className="truncate font-semibold hover:underline">{user.name}</Link>
                  <Tick user={user} />
                  {i === 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-[6px] bg-ds-accent-soft px-1.5 py-px text-[12px] font-medium leading-4 text-ds-accent-text">
                      <Trophy className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> Top
                    </span>
                  )}
                </p>
                <p className="muted truncate text-[13px] leading-5">
                  {user.username && `@${user.username} · `}
                  {userTitle(user)}
                </p>
                {user.institution && <p className="muted truncate text-[13px] leading-5">{user.institution}</p>}
                <p className="ds-num text-[13px] font-medium leading-5 text-ds-fg-2">{contributionLine(row)}</p>
              </div>
              {user._id !== me?._id && <FollowButton userId={user._id} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A Ward: header with Join, then Pearls / Cases / Discussions / Top contributors. */
export default function Ward() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0];
  const [openId, setOpenId] = useState(null);
  const valid = isWard(slug);
  useVisitWard(valid ? slug : null);
  const { data, isPending } = useQuery({
    queryKey: ['ward', slug],
    queryFn: () => api.get(`/wards/${slug}`).then((r) => r.data),
    enabled: valid,
  });
  const m = specialtyMeta(slug);
  const groupLabel = WARD_GROUPS.find((g) => g.id === m.group)?.label;

  if (!valid) {
    return (
      <PageShell>
        <NotFoundState icon={Hospital} title="There's no Ward with that name" extra={<Link to="/wards" className="btn-secondary">See all Wards</Link>} />
      </PageShell>
    );
  }
  if (isPending) return <PageShell><PageLoader /></PageShell>;

  const { ward, contributors } = data;
  return (
    <PageShell
      cards
      wide="xl"
      docTitle={`${m.label} Ward`}
    >
      {/* header: editorial, no coloured banner; the specialty's colour is only the dot */}
      <section className="px-2 pb-1 pt-3 md:px-1 md:pt-4">
        <Link to="/wards" className="inline-flex min-h-9 items-center gap-1 rounded-full text-[13px] font-medium text-ds-fg-3 transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> All Wards
        </Link>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <p className="ds-eyebrow flex items-center gap-1.5">
              <SpecialtyDot hue={m.hue} /> {groupLabel ? `${groupLabel} Ward` : 'Ward'}
            </p>
            <h1 className="mt-1 flex items-center gap-3 font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em] sm:text-[40px] sm:leading-[44px] sm:tracking-[-0.02em]">
              <m.icon className="h-7 w-7 shrink-0 text-ds-fg-3 sm:h-8 sm:w-8" strokeWidth={1.25} aria-hidden="true" />
              <span className="min-w-0 break-words">{m.label}</span>
            </h1>
          </div>
          <JoinWardButton ward={ward} primary className="min-h-10 px-4 text-[15px]" />
        </div>
        {/* stats: tabular numbers over small labels, divided by hairlines (no boxes) */}
        <dl className="mt-4 flex divide-x divide-line">
          {[
            [Users, ward.members, ward.members === 1 ? 'Member' : 'Members'],
            [FileText, ward.posts, ward.posts === 1 ? 'Post' : 'Posts'],
          ].map(([Icon, n, label], i) => (
            <div key={label} className={cn('pr-6', i > 0 && 'pl-6')}>
              <dd className="ds-num text-[20px] font-medium leading-[26px]">{n ?? 0}</dd>
              <dt className="ds-eyebrow flex items-center gap-1"><Icon className="h-3 w-3" strokeWidth={1.75} /> {label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* tabs sit under the Ward's header and stick to the top while you scroll */}
      <div className="ds-glass sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-2 overflow-clip rounded-none md:top-2 md:mx-0 md:rounded-[20px]">
        <div role="tablist" className="no-scrollbar flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab.id}
              onClick={() => setParams(t.id === 'pearls' ? {} : { tab: t.id }, { replace: true })}
              className={cn('tab flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-2', t.id === tab.id && 'tab-active')}
            >
              <t.icon className="h-4 w-4" strokeWidth={1.5} />
              <span className="sm:hidden">{t.short ?? t.label}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab.id === 'pearls' && (
        <>
          <SwipePearlsButton params={{ tag: slug }} subject={m.label} />
          <PearlGrid
            queryKey={['posts', 'ward', slug, 'pearls']}
            params={{ tag: slug }}
            empty={<EmptyState icon={Lightbulb} title={`No pearls in ${m.label} yet`}>Share a short, high-yield fact or an image (ECG, X-ray, slide).</EmptyState>}
          />
        </>
      )}
      {tab.id === 'cases' && (
        <InfiniteFeed
          key="cases"
          variant="cards"
          queryKey={['posts', 'ward', slug, 'cases']}
          params={{ tag: slug, type: 'case_study' }}
          empty={<EmptyState icon={Stethoscope} title={`No cases in ${m.label} yet`}>Share a de-identified case for the Ward to work through.</EmptyState>}
        />
      )}
      {tab.id === 'discussions' && (
        <InfiniteFeed
          key="discussions"
          variant="cards"
          queryKey={['posts', 'ward', slug, 'discussions']}
          params={{ tag: slug, kinds: 'question,discussion,notes' }}
          empty={<EmptyState icon={MessagesSquare} title="No discussions yet">Ask the Ward a question to get things going.</EmptyState>}
        />
      )}
      {tab.id === 'contributors' && <Contributors list={contributors} windowDays={data.rankingWindowDays} />}

      <PostModal postId={openId} onClose={() => setOpenId(null)} />
    </PageShell>
  );
}
