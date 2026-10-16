import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SearchSuggest from './SearchSuggest';
import { api } from '../api/client';
import { useNotificationSocket } from '../hooks/useSocket';
import { Sidebar, TopBar, MobileNav } from './Navbar';
import Composer from './Composer';
import Onboarding from './Onboarding';
import { useTrackAppShortcut } from './AppShortcut';
import { useAuthStore } from '../store/auth';
import UserRow, { FollowButton } from './UserRow';
import Avatar from './Avatar';
import { Tick } from './VerificationBadge';
import { PageLoader } from './ui';
import { prettyTag, userTitle } from '../lib/constants';
import { LEGAL_DOCS } from '../lib/legal';
import { SponsoredRailCard } from './Ads';
import StudyStreak from './StudyProgress';
import { useWards, useToggleWard } from '../hooks/useWards';
import { useLeaveDemoAccount } from '../hooks/useAccounts';
import { specialtyMeta, wardOf } from '../lib/specialties';
import { prefetchProps } from '../lib/routes';
import { cn, pluralize } from '../lib/format';
import { useTrendingCases } from '../hooks/useTrendingCases';
import { useMediaQuery, RAIL_QUERY } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Button } from './ds/Button';
import { SpecialtyDot } from './ds/display';

/**
 * App frame: glass sidebar | centre column | right column (>= 1280px only).
 * Phones get the top bar + bottom tab bar instead of the sidebar.
 */
export default function Layout() {
  useNotificationSocket();
  useTrackAppShortcut();
  const me = useAuthStore((s) => s.user);
  // First login: the welcome steps (not for members who already joined Wards before they existed).
  const needsOnboarding = me && !me.onboardedAt && !me.wards?.length;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1360px] justify-center">
      {/* the slow-drifting colour the glass bars refract (fixed, behind everything) */}
      <div className="ds-backdrop" aria-hidden="true" />
      {/* first thing a keyboard user reaches */}
      <a href="#content" className="ds-glass-strong fixed left-3 top-3 z-[80] -translate-y-24 rounded-ds-md px-4 py-2.5 font-ui text-meta font-semibold text-ds-fg transition focus:translate-y-0">
        Skip to content
      </a>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </div>
      <MobileNav />
      <Composer />
      {needsOnboarding && <Onboarding />}
      {me?.isDemo && <DemoSessionBar me={me} />}
    </div>
  );
}

/** Floating reminder while an admin is using a demo account, with a one-tap way back. */
function DemoSessionBar({ me }) {
  const leave = useLeaveDemoAccount();
  return (
    <div
      role="status"
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[70] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-full bg-ds-accent py-1.5 pl-4 pr-1.5 font-ui text-[13px] text-white shadow-lg md:bottom-5"
    >
      <span className="truncate">
        Demo account: <strong className="font-semibold">{me.name}</strong>
      </span>
      <button
        onClick={() => leave.mutate()}
        disabled={leave.isPending}
        className="shrink-0 rounded-full bg-white px-3 py-1.5 font-semibold text-ds-accent-text transition hover:bg-white/90"
      >
        {leave.isPending ? 'Switching…' : 'Switch back'}
      </button>
    </div>
  );
}

/** Rounded search box at the top of the right rail. */
function RailSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <SearchSuggest
      value={q}
      onChange={setQ}
      onSubmit={() => q.trim() && navigate(`/discover?q=${encodeURIComponent(q.trim())}`)}
      placeholder="Search Tectum"
      inputClassName="bg-surface"
    />
  );
}

/** The default right column (>= 1280px): your progress & streak, trending cases, suggested Wards, people. */
function DefaultRail() {
  return (
    <>
      <StudyStreak />
      <TrendingCases />
      <SuggestedWards />
      <ConnectWithExperts />
    </>
  );
}

/** The most-discussed cases right now. */
export function TrendingCases() {
  const { data } = useTrendingCases();
  if (!data?.length) return null;
  return (
    <RailCard title="Trending cases" flush action={<RailLink to="/cases">All</RailLink>}>
      <ul className="divide-y divide-ds-line">
        {data.map((p) => {
          const ward = wardOf(p);
          return (
            <li key={p._id}>
              <Link to={`/cases/${p._id}`} {...prefetchProps('/cases')} className="ds-focus block px-4 py-2.5 transition-colors hover:bg-ds-surface-2">
                <p className="line-clamp-2 font-editorial text-lead font-medium text-ds-fg">{p.title || p.caseStudy?.chiefComplaint}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-caption text-ds-fg-3">
                  {ward && <SpecialtyDot hue={specialtyMeta(ward).hue} />}
                  {[ward && specialtyMeta(ward).label, p.commentCount > 0 && `${pluralize(p.commentCount, 'answer')}`].filter(Boolean).join(' · ')}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </RailCard>
  );
}

/** A few Wards you haven't joined, busiest first, with a one-tap Join. */
export function SuggestedWards() {
  const { data } = useWards();
  const toggle = useToggleWard();
  const picks = (data ?? []).filter((w) => !w.joined).sort((a, b) => b.posts + b.members - (a.posts + a.members)).slice(0, 3);
  if (!picks.length) return null;
  return (
    <RailCard title="Suggested Wards" flush action={<RailLink to="/wards">All</RailLink>}>
      <ul>
        {picks.map((w) => {
          const m = specialtyMeta(w.slug);
          return (
            <li key={w.slug} className="flex items-center gap-3 px-4 py-2">
              <Link to={`/ward/${w.slug}`} className="ds-focus flex min-w-0 flex-1 items-center gap-3 rounded-ds-md">
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-ds-md border border-ds-line bg-ds-surface-2 text-ds-fg-2">
                  <m.icon className="size-4" strokeWidth={1.5} />
                  <SpecialtyDot hue={m.hue} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-ds-surface" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-ds-fg">{m.label}</span>
                  <span className="ds-num block text-caption text-ds-fg-3">{w.posts ? `${pluralize(w.posts, 'post')}` : 'New ward'}</span>
                </span>
              </Link>
              <Button variant="outline" size="sm" onClick={() => toggle.mutate(w.slug)} disabled={toggle.isPending} aria-label={`Join ${m.label}`}>
                Join
              </Button>
            </li>
          );
        })}
      </ul>
    </RailCard>
  );
}

/**
 * Right column, X-style: the search box stays pinned at the top; the cards below scroll with
 * the page only until their last one is in view, then stay put while the feed keeps scrolling.
 * That's a sticky block whose `top` is the viewport height minus its own height (never above
 * the search box), recomputed whenever the cards or the window change size.
 */
function RightRail({ rail }) {
  // Below 1280px the rail isn't shown, so don't mount it at all: its widgets would still fetch
  // suggestions, ads, trending cases and activity that nobody sees.
  const visible = useMediaQuery(RAIL_QUERY);
  return visible ? <RightRailBody rail={rail} /> : null;
}

function RightRailBody({ rail }) {
  const searchRef = useRef(null);
  const bodyRef = useRef(null);
  const [top, setTop] = useState(0);

  useEffect(() => {
    const update = () => {
      const searchH = searchRef.current?.offsetHeight ?? 0;
      const bodyH = bodyRef.current?.offsetHeight ?? 0;
      setTop(Math.min(searchH, window.innerHeight - bodyH));
    };
    update();
    const ro = new ResizeObserver(update);
    if (bodyRef.current) ro.observe(bodyRef.current);
    if (searchRef.current) ro.observe(searchRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <aside className="hidden w-[340px] shrink-0 font-ui xl:block" aria-label="Your progress and suggestions">
      <div ref={searchRef} className="sticky top-0 z-10 py-2">
        <RailSearch />
      </div>
      <div ref={bodyRef} className="sticky space-y-3 pb-6 pt-1" style={{ top }}>
        {rail ?? <DefaultRail />}
        {/* ads sit below the study tools: small and clearly labelled */}
        <SponsoredRailCard />
        <RailFooter />
      </div>
    </aside>
  );
}

/**
 * Page frame: the centre column on the soft page background, with an optional sticky header
 * (title/tabs) and the right rail.
 *  - default: the page's content sits inside one rounded card.
 *  - `cards`: the page lays out its own separate cards (the feed, My Notebook).
 *  - `wide`: no rail, for pages that need room (settings, moderation); `wide="xl"` for two-pane pages.
 * (`bare` is kept for older callers and means the same as the default.)
 */
export function PageShell({ title, docTitle, subtitle, actions, tabs, children, rail, cards = false, wide = false }) {
  const hasHeader = title || actions || tabs;
  // Tab title "<page> · Tectum": the heading, or `docTitle` for pages without one (or a different one).
  useDocumentTitle(docTitle ?? (typeof title === 'string' ? title : undefined));
  return (
    <div className="flex justify-center gap-6 px-0 md:px-3 xl:justify-start">
      <main
        id="content"
        tabIndex={-1}
        className={cn(
          // phones: the top bar sits above, so the page is exactly one screen tall (a short page can't slide)
          'x-main min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] w-full min-w-0 space-y-3 px-2 pb-28 pt-2 outline-none md:min-h-dvh md:px-0 md:pb-10',
          wide === 'xl' ? 'max-w-[1120px]' : wide ? 'max-w-[960px]' : 'max-w-[680px]'
        )}
      >
        {hasHeader && (
          // the standard page header: glass, sticky, serif title + one-line subtitle, actions on the right
          <div className="ds-glass sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-2 rounded-none font-ui text-ds-fg md:top-2 md:mx-0 md:rounded-ds-lg">
            {(title || actions) && (
              <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 md:px-5">
                <div className="min-w-0">
                  {title && <h1 className="truncate font-editorial text-title font-medium md:text-headline">{title}</h1>}
                  {subtitle && <p className="truncate text-meta text-ds-fg-3">{subtitle}</p>}
                </div>
                {actions}
              </div>
            )}
            {tabs}
          </div>
        )}
        {cards ? children : <div className={cn('card overflow-clip', !hasHeader && 'md:mt-3')}>{children}</div>}
      </main>
      {!wide && <RightRail rail={rail} />}
    </div>
  );
}

/** Right-rail box: flat content card (hairline, 12px corners) with a serif title. */
export function RailCard({ title, action, children, className, flush = false }) {
  return (
    <section className={cn('ds-card text-ds-fg', flush ? 'py-3' : 'px-4 py-3', className)}>
      {title && (
        <div className={cn('mb-2 flex items-baseline justify-between', flush && 'px-4')}>
          <h2 className="font-editorial text-title font-medium">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Small blue "All" / "Show more" link in a rail card. */
function RailLink({ to, children, className }) {
  return (
    <Link to={to} className={cn('ds-focus rounded-ds-sm text-meta font-medium text-ds-brand-text hover:underline', className)}>
      {children}
    </Link>
  );
}

export function useTrends() {
  return useQuery({
    queryKey: ['trending'],
    queryFn: () => api.get('/posts/trending').then((r) => r.data.trends),
    staleTime: 5 * 60_000,
  });
}

export function ClinicalTrends() {
  const { data } = useTrends();
  if (!data?.length) return null;
  return (
    <RailCard title="Trending in medicine" flush>
      <ul>
        {data.slice(0, 5).map((t) => (
          <li key={t.tag}>
            <Link
              to={`/discover?q=${encodeURIComponent('#' + t.tag)}`}
              className="block px-4 py-2.5 transition hover:bg-surface-2"
            >
              <p className="muted text-[13px]">Trending</p>
              <p className="text-[15px] font-semibold capitalize">{prettyTag(t.tag)}</p>
              <p className="muted text-[13px]">
                {pluralize(t.posts, 'post')}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

function useSuggestions({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.get('/users/suggestions').then((r) => r.data.users),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function ConnectWithExperts({ title = 'Who to follow' }) {
  const { data } = useSuggestions();
  if (!data?.length) return null;
  return (
    <RailCard title={title} flush>
      <div>
        {data.map((u) => (
          <UserRow key={u._id} user={u} showStats />
        ))}
      </div>
      <RailLink to="/discover?tab=specialists" className="mx-4 mt-3 inline-block">
        Show more
      </RailLink>
    </RailCard>
  );
}

/**
 * Who to follow for phones and tablets (the right column only shows from 1280px): one row of
 * small cards that scrolls sideways. Not mounted on wide screens, where the rail card shows instead.
 */
export function WhoToFollowStrip() {
  const wide = useMediaQuery(RAIL_QUERY);
  const { data } = useSuggestions({ enabled: !wide });
  if (wide || !data?.length) return null;
  return (
    <section className="card overflow-clip py-3" aria-label="Who to follow">
      <div className="flex items-baseline justify-between px-4">
        <h2 className="font-editorial text-title font-medium">Who to follow</h2>
        <RailLink to="/discover?tab=specialists">Show more</RailLink>
      </div>
      <ul className="no-scrollbar mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
        {data.map((u) => (
          <li key={u._id} className="w-[168px] shrink-0 snap-start">
            <Link to={`/profile/${u._id}`} className="flex h-full flex-col items-center rounded-ds-md border border-line px-3 py-3 text-center transition hover:bg-surface-2">
              <Avatar user={u} size="lg" />
              <p className="mt-2 flex w-full items-center justify-center gap-1 text-[15px] font-semibold leading-5">
                <span className="truncate">{u.name}</span> <Tick user={u} />
              </p>
              {u.username && <p className="muted w-full truncate text-[13px] leading-5">@{u.username}</p>}
              <p className="muted w-full truncate text-[13px] leading-5">{userTitle(u)}</p>
              {u.institution && <p className="muted w-full truncate text-[12px] leading-4">{u.institution}</p>}
              {u.reason && <p className="mt-1 w-full truncate text-[12px] font-medium leading-4 text-ds-brand-text">{u.reason}</p>}
              <FollowButton userId={u._id} className="mt-2.5 w-full" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RailFooter() {
  return (
    <div className="px-4 font-ui text-caption text-ds-fg-3">
      <p className="flex flex-wrap gap-x-3 gap-y-0.5">
        {LEGAL_DOCS.map((d) => (
          <Link key={d.slug} to={`/legal/${d.slug}`} className="ds-focus rounded-ds-sm hover:text-ds-fg hover:underline">{d.title}</Link>
        ))}
      </p>
      <p className="mt-1">For education and peer discussion, not medical advice. © {new Date().getFullYear()} Tectum</p>
    </div>
  );
}
