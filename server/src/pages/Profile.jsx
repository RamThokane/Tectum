import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  UserX,
  Clock,
  Stethoscope,
  Image as ImageIcon,
  MessageSquareText,
  Share2,
  Repeat2,
  Mail,
  MoreHorizontal,
  UserPlus,
  UserMinus,
  VolumeX,
  Volume2,
  Ban,
  Flag,
  Link2,
  GraduationCap,
} from 'lucide-react';
import { api } from '../api/client';
import { toast } from '../store/ui';
import { useAuthStore } from '../store/auth';
import { PageShell, RailCard, ConnectWithExperts } from '../components/Layout';
import InfiniteFeed from '../components/InfiniteFeed';
import CommentList from '../components/CommentList';
import CoverPhoto from '../components/CoverPhoto';
import { StreakFlame } from '../components/ds/icons';
import Avatar from '../components/Avatar';
import { Tick, RolePill, hasBlueTick } from '../components/VerificationBadge';
import PortfolioTab, { DownloadCvButton } from '../components/Portfolio';
import SpecialtyTagChip from '../components/SpecialtyTagChip';
import VerifyModal from '../components/VerifyModal';
import UserRow, { FollowButton, useFollow } from '../components/UserRow';
import { EmptyState, ErrorState, Modal, PageLoader } from '../components/ui';
import NotFoundState from '../components/NotFoundState';
import { cn, compact, plural, pluralize } from '../lib/format';
import { useStudyActivity } from '../components/StudyProgress';
import { courseLabel } from '../lib/courses';
import { countryName } from '../lib/countries';

const TABS = [
  { id: 'posts', label: 'Posts', params: {}, icon: MessageSquareText },
  { id: 'cases', label: 'Cases Shared', params: { type: 'case_study' }, icon: Stethoscope },
  { id: 'portfolio', label: 'Academic Portfolio', icon: GraduationCap },
  { id: 'media', label: 'Media', params: { media: true }, icon: ImageIcon },
  { id: 'reposts', label: 'Reposts', params: { reposts: true }, icon: Repeat2 },
];

function ConnectionsModal({ userId, kind, onClose }) {
  // Paged: 30 at a time, newest first, with "Show more".
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['user', userId, kind],
    queryFn: ({ pageParam }) => api.get(`/users/${userId}/${kind}`, { params: { page: pageParam, limit: 30 } }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
  const users = data?.pages.flatMap((p) => p.users) ?? [];
  return (
    <Modal open onClose={onClose} title={kind === 'followers' ? 'Followers' : 'Following'} size="max-w-md">
      {isPending ? <PageLoader /> : users.length === 0 ? (
        <EmptyState title={kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'} />
      ) : (
        <div className="py-2">
          {users.map((u) => <UserRow key={u._id} user={u} showBio />)}
          {hasNextPage && (
            <div className="px-4 py-3 text-center">
              <button className="btn-secondary" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Report dialog for a profile: optional reason, goes to the moderators. */
function ReportUserModal({ user, onClose }) {
  const [reason, setReason] = useState('');
  const send = useMutation({
    mutationFn: () => api.post(`/users/${user._id}/report`, { reason: reason.trim() }).then((r) => r.data),
    onSuccess: (d) => {
      toast(d.message);
      onClose();
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Report ${user.name}`}
      size="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => send.mutate()} disabled={send.isPending}>{send.isPending ? 'Sending…' : 'Report'}</button>
        </div>
      }
    >
      <div className="space-y-2 p-5">
        <label className="label" htmlFor="report-reason">What's wrong with this account? <span className="muted font-normal">(optional)</span></label>
        <textarea
          id="report-reason"
          className="input"
          rows={4}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Pretending to be a doctor, sharing patient details, spam, harassment"
        />
        <p className="muted text-[13px]">They won't be told who reported them.</p>
      </div>
    </Modal>
  );
}

/**
 * The "⋯" button on someone's profile (X-style menu): follow, mute, block, report, copy link.
 * `onChanged` refreshes the profile after mute/block.
 */
function ProfileMenu({ user, onChanged, onReport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const follow = useFollow(user._id);
  const setUser = useAuthStore((s) => s.setUser);
  const following = follow.data ? follow.data.following : user.isFollowing;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggle = useMutation({
    mutationFn: (kind) => api.post(`/users/${user._id}/${kind}`).then((r) => ({ kind, ...r.data })),
    onSuccess: async ({ kind, muted, blocked }) => {
      if (kind === 'mute') toast(muted ? `You muted ${user.name}. Their posts won't show in your feeds.` : `You unmuted ${user.name}`);
      if (kind === 'block') {
        toast(blocked ? `You blocked ${user.name}` : `You unblocked ${user.name}`);
        // Blocking removes follows both ways, so refresh who I follow.
        const me = await api.get('/auth/me').then((r) => r.data.user).catch(() => null);
        if (me) setUser(me);
      }
      onChanged();
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${user._id}`);
      toast('Profile link copied');
    } catch {
      /* ignore */
    }
  };

  const run = (fn) => () => {
    setOpen(false);
    fn();
  };
  const item = 'flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-left text-[15px] font-medium transition-colors hover:bg-surface-2 [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0 [&>svg]:stroke-[1.5]';

  return (
    // Phones: the menu hangs from the whole button row (relative parent), so it can't spill off the left edge.
    <div ref={ref} className="sm:relative">
      <button
        className="btn-secondary h-9 w-9 p-0"
        onClick={() => setOpen((o) => !o)}
        title="More"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
      </button>
      {open && (
        <div
          role="menu"
          className="ds-glass-strong ds-rise absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[12px] p-1.5"
        >
          {!user.isBlocked && !user.hasBlockedYou && (
            <button role="menuitem" className={item} onClick={run(() => follow.mutate())}>
              {following ? <UserMinus className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              <span className="truncate">{following ? 'Unfollow' : 'Follow'} {user.name}</span>
            </button>
          )}
          <button role="menuitem" className={item} onClick={run(() => toggle.mutate('mute'))}>
            {user.isMuted ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            <span className="truncate">{user.isMuted ? 'Unmute' : 'Mute'} {user.name}</span>
          </button>
          <button
            role="menuitem"
            className={cn(item, !user.isBlocked && 'text-danger')}
            onClick={run(() => {
              if (user.isBlocked || window.confirm(`Block ${user.name}? They won't be able to follow you, reply to your posts or message you, and you'll stop following each other.`)) {
                toggle.mutate('block');
              }
            })}
          >
            <Ban className="h-5 w-5" />
            <span className="truncate">{user.isBlocked ? 'Unblock' : 'Block'} {user.name}</span>
          </button>
          <button role="menuitem" className={item} onClick={run(onReport)}>
            <Flag className="h-5 w-5" /> <span className="truncate">Report {user.name}</span>
          </button>
          <button role="menuitem" className={item} onClick={run(copy)}>
            <Link2 className="h-5 w-5" /> Copy link to profile
          </button>
        </div>
      )}
    </div>
  );
}

/** Shown instead of Message/Follow on a blocked profile, like X: "Blocked", which turns into "Unblock" on hover. */
function UnblockButton({ user, onDone }) {
  const unblock = useMutation({
    mutationFn: () => api.post(`/users/${user._id}/block`),
    onSuccess: () => {
      toast(`You unblocked ${user.name}`);
      onDone();
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <button
      className="btn border border-danger/40 bg-danger-soft px-4 py-1.5 text-danger hover:bg-danger hover:text-white [&:hover>.a]:hidden [&:not(:hover)>.b]:hidden"
      onClick={() => unblock.mutate()}
      disabled={unblock.isPending}
    >
      <span className="a">Blocked</span>
      <span className="b">Unblock</span>
    </button>
  );
}

/** Envelope button on someone's profile: opens (or starts) your encrypted chat with them. */
function MessageButton({ userId }) {
  const navigate = useNavigate();
  const start = useMutation({
    mutationFn: () => api.post('/chat/conversations', { userId }).then((r) => r.data.conversation),
    onSuccess: (c) => navigate(`/messages/${c._id}`),
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <button className="btn-secondary h-9 w-9 p-0" onClick={() => start.mutate()} disabled={start.isPending} title="Message" aria-label="Send a message">
      <Mail className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}

/** Only the one status worth spelling out; the tick next to the name covers the rest. */
function StatusNote({ user }) {
  if (user.isSelf && user.verificationStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[15px] text-warning">
        <Clock className="h-4 w-4" strokeWidth={1.5} /> Verification pending
      </span>
    );
  }
  return null;
}

function useStudyStats(userId) {
  return useQuery({
    queryKey: ['user', userId, 'study-stats'],
    queryFn: () => api.get(`/users/${userId}/study-stats`).then((r) => r.data),
    staleTime: 60_000,
  });
}

/** Cases solved · accuracy · streak (own profile) · followers. Nothing shows as a bare zero. */
function StatsRow({ user, stats, onFollowers }) {
  const { data: activity } = useStudyActivity();
  const streak = user.isSelf ? activity?.streak ?? 0 : null;
  const items = [
    { label: 'Cases solved', value: stats?.solved ? compact(stats.solved) : '—', hint: stats?.solved ? null : 'none yet' },
    { label: 'Accuracy', value: stats?.accuracy != null ? `${stats.accuracy}%` : '—', hint: stats?.accuracy != null ? `${pluralize(stats.answered, 'poll')}` : 'answer a poll' },
    user.isSelf
      ? { label: 'Day streak', value: streak || '—', flame: streak > 0, hint: streak ? null : 'start today' }
      : { label: 'Cases shared', value: user.caseCount ? compact(user.caseCount) : '—' },
    { label: plural('Follower', user.followerCount ?? 0), value: compact(user.followerCount ?? 0), onClick: onFollowers },
  ];
  return (
    // stats: big tabular numbers over small uppercase labels, divided by hairlines (no boxes)
    <dl className="mt-5 grid grid-cols-2 border-y border-line sm:grid-cols-4">
      {items.map((s, i) => {
        const Tag = s.onClick ? 'button' : 'div';
        return (
          <Tag
            key={s.label}
            onClick={s.onClick}
            className={cn(
              'flex flex-col-reverse justify-end px-3 py-3 text-left first:pl-0 sm:border-l sm:border-line sm:first:border-l-0',
              i % 2 === 1 && 'border-l border-line',
              i > 1 && 'border-t border-line sm:border-t-0',
              i === 2 && 'pl-0 sm:pl-3',
              s.onClick && 'transition-colors hover:text-link'
            )}
          >
            <dt className="ds-eyebrow mt-1">
              {s.label}
              {s.hint && <span className="block font-normal normal-case tracking-normal">{s.hint}</span>}
            </dt>
            <dd className="ds-num flex items-center gap-1.5 text-[28px] font-medium leading-8 tracking-[-0.015em]">
              {s.value}
              {s.flame && <StreakFlame size={22} />}
            </dd>
          </Tag>
        );
      })}
    </dl>
  );
}

/** Own profile: completion % with the next missing pieces, instead of a bare "No bio yet". */
function CompleteProfile({ user }) {
  const steps = [
    { done: Boolean(user.profilePicture), label: 'Add a profile photo' },
    { done: Boolean(user.bio?.trim()), label: 'Write a short bio' },
    { done: user.specialtyTags?.length > 0, label: 'Add your specialties' },
    { done: Boolean(user.institution), label: 'Add your college or hospital' },
    { done: user.verificationStatus === 'verified', label: 'Get verified' },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <section className="mt-4 rounded-[12px] border border-line p-3.5" aria-labelledby="complete-profile">
      <div className="flex items-center justify-between gap-3">
        <h2 id="complete-profile" className="ds-num text-[15px] font-semibold">Your profile is {pct}% complete</h2>
        <Link to="/settings" className="btn-secondary min-h-9 px-3 text-[13px]">Complete profile</Link>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
        <div className="h-full rounded-full bg-ds-brand" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted mt-2 text-[13px]">Next: {steps.filter((s) => !s.done).slice(0, 2).map((s) => s.label.toLowerCase()).join(', ')}. A complete profile helps colleagues trust your cases.</p>
    </section>
  );
}

function ImpactCard({ user }) {
  const stats = [
    { label: 'Posts', value: user.postCount },
    { label: 'Likes received', value: user.likesReceived },
    { label: 'Case studies', value: user.caseCount },
    { label: 'Notes saved by others', value: user.savesReceived },
  ].filter((s) => s.value > 0);
  if (!stats.length) return null;
  return (
    <RailCard title="Activity">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pb-1">
        {stats.map((s) => (
          <div key={s.label}>
            <dd className="ds-num text-[20px] font-medium leading-[26px]">{compact(s.value ?? 0)}</dd>
            <dt className="ds-eyebrow">{s.label}</dt>
          </div>
        ))}
      </dl>
    </RailCard>
  );
}

function TickPromo({ user, onVerify }) {
  if (!user.isSelf || hasBlueTick(user)) return null;
  const pending = user.verificationStatus === 'pending';
  return (
    <RailCard title="Get the blue tick, free">
      <p className="text-[15px] leading-[23px] text-ds-fg-2">
        {pending
          ? 'Your document is under review. Once it is approved you get the blue tick.'
          : 'Upload your licence or student ID. Once it is approved you get the blue tick, free.'}
      </p>
      {!pending && (
        <button onClick={onVerify} className="btn-primary mb-1 mt-3">Get verified</button>
      )}
    </RailCard>
  );
}

export default function Profile() {
  const { id } = useParams();
  const [tab, setTab] = useState('posts');
  const [modal, setModal] = useState(null);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/users/${id}`).then((r) => r.data),
  });

  const { data: stats } = useStudyStats(id);
  useEffect(() => setTab('posts'), [id]);

  if (isPending) return <PageShell><PageLoader count={2} /></PageShell>;
  if (isError) {
    return (
      <PageShell>
        {[400, 404].includes(error.response?.status) ? (
          <NotFoundState icon={UserX} title="This account doesn't exist">It may have been deleted or deactivated.</NotFoundState>
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </PageShell>
    );
  }

  const user = data.user;
  const current = TABS.find((t) => t.id === tab);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Profile link copied');
    } catch {
      /* ignore */
    }
  };

  return (
    <PageShell
      bare
      docTitle={user.name}
      rail={
        <>
          <TickPromo user={user} onVerify={() => setModal('verify')} />
          <ImpactCard user={user} />
          <ConnectWithExperts />
        </>
      }
    >
      <div>
        {/* X-style header: grey (or photo) banner, avatar overlapping it, buttons on the right */}
        <section>
          <CoverPhoto user={user} className="h-32 sm:h-44" />
          <div className="px-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <Avatar user={user} size="xl" className="relative z-10 -mt-12 ring-4 ring-ds-surface sm:-mt-16" />
              {/* X's order: ⋯ · message · Follow (your own profile: share · Edit profile) */}
              <div className="relative flex flex-wrap justify-end gap-2 pt-3">
                {user.isSelf ? (
                  <>
                    <button className="btn-secondary h-9 w-9 p-0" onClick={share} title="Copy profile link" aria-label="Copy profile link">
                      <Share2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <DownloadCvButton user={user} className="hidden sm:inline-flex" />
                    <Link to="/settings" className="btn-secondary">Edit profile</Link>
                  </>
                ) : (
                  <>
                    <ProfileMenu user={user} onChanged={refetch} onReport={() => setModal('report')} />
                    {user.isBlocked ? (
                      <UnblockButton user={user} onDone={refetch} />
                    ) : (
                      !user.hasBlockedYou && (
                        <>
                          <MessageButton userId={user._id} />
                          <FollowButton userId={user._id} isFollowing={user.isFollowing} />
                        </>
                      )
                    )}
                  </>
                )}
              </div>
            </div>

            <h1 className="mt-3 flex flex-wrap items-center gap-1.5 font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em] sm:text-[40px] sm:leading-[44px] sm:tracking-[-0.02em]">
              {user.name} <Tick user={user} className="h-5 w-5 sm:h-6 sm:w-6" />
            </h1>
            <div className="mt-1">
              <RolePill user={user} className="px-2 py-0.5" />
            </div>

            {user.bio && <p className="mt-3 whitespace-pre-wrap text-[17px] leading-[26px] text-ds-fg-2">{user.bio}</p>}
            {user.specialtyTags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.specialtyTags.map((t) => <SpecialtyTagChip key={t} tag={t} />)}
              </div>
            )}

            <div className="muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <StatusNote user={user} />
              {user.institution && <span className="flex items-center gap-1"><Building2 className="h-4 w-4" strokeWidth={1.5} /> {user.institution}</span>}
              {(user.course || user.country) && (
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" strokeWidth={1.5} /> {[courseLabel(user.course), countryName(user.country)].filter(Boolean).join(' · ')}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" strokeWidth={1.5} /> Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="mt-3 flex gap-5 text-[15px]">
              <button onClick={() => setModal('following')} className="min-h-9 hover:underline">
                <strong className="ds-num font-semibold text-ink">{compact(user.followingCount)}</strong> <span className="muted">Following</span>
              </button>
            </div>
            <StatsRow user={user} stats={stats} onFollowers={() => setModal('followers')} />
            {user.isSelf && <CompleteProfile user={user} />}
            {user.isSelf && user.verificationStatus === 'unverified' && (
              <button className="btn-primary mt-3 lg:hidden" onClick={() => setModal('verify')}>
                Get verified
              </button>
            )}
          </div>
        </section>

        {/* glass tab bar that sticks under the top bar; scrolls sideways inside itself on phones */}
        <div className="ds-glass sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 rounded-none border-x-0 md:top-2">
          <div role="tablist" aria-label="Profile sections" className="no-scrollbar flex overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('tab inline-flex shrink-0 grow items-center justify-center gap-1.5', tab === t.id && 'tab-active')}>
                <t.icon className="h-4 w-4" strokeWidth={1.5} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {user.isBlocked || user.hasBlockedYou ? (
          <EmptyState icon={Ban} title={user.isBlocked ? `You blocked ${user.name}` : `${user.name} has blocked you`}>
            {user.isBlocked
              ? "You won't see their posts, and they can't follow you, reply to your posts or message you. Unblock them to see their posts again."
              : "You can't follow them, see their posts or message them."}
          </EmptyState>
        ) : tab === 'portfolio' ? (
          <PortfolioTab user={user} />
        ) : (
          <>
        {/* reposted comments sit above reposted posts on the Reposts tab */}
        {tab === 'reposts' && (
          <CommentList key={id} queryKey={['reposted-comments', id]} url={`/users/${id}/reposted-comments`} repostedBy={user.isSelf ? 'You' : user.name} />
        )}
        <InfiniteFeed
          key={`${id}-${tab}`}
          queryKey={['posts', 'user', id, tab]}
          url={`/users/${id}/posts`}
          params={current.params}
          empty={
            <EmptyState icon={current.icon} title={`No ${current.label.toLowerCase()} yet`}>
              {current.id === 'reposts'
                ? user.isSelf
                  ? 'Posts you repost will show up here.'
                  : `${user.name} hasn't reposted anything yet.`
                : user.isSelf
                  ? 'When you share something, it will show up here.'
                  : `${user.name} hasn't shared any ${current.label.toLowerCase()} yet.`}
            </EmptyState>
          }
        />
          </>
        )}
      </div>

      {modal === 'verify' && <VerifyModal userId={user._id} onClose={() => setModal(null)} />}
      {modal === 'report' && <ReportUserModal user={user} onClose={() => setModal(null)} />}
      {(modal === 'followers' || modal === 'following') && <ConnectionsModal userId={id} kind={modal} onClose={() => setModal(null)} />}
    </PageShell>
  );
}
