import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import Avatar from './Avatar';
import { Tick } from './VerificationBadge';
import { userTitle } from '../lib/constants';
import { cn, compact } from '../lib/format';

const FOLLOWING_IDS = ['me', 'following-ids'];

/**
 * Who I follow, as a Set of ids, for Follow buttons. Loaded once when the first Follow button
 * appears (not with every page as part of /auth/me) and kept up to date by useFollow.
 */
export function useFollowingIds({ enabled = true } = {}) {
  const status = useAuthStore((s) => s.status);
  const { data } = useQuery({
    queryKey: FOLLOWING_IDS,
    queryFn: () => api.get('/users/me/following-ids').then((r) => r.data.ids),
    enabled: enabled && status === 'authenticated',
    staleTime: 5 * 60_000,
  });
  return useMemo(() => new Set(data ?? []), [data]);
}

export function useFollow(userId) {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: () => api.post(`/users/${userId}/follow`).then((r) => r.data),
    onSuccess: ({ following, followerCount }) => {
      qc.setQueryData(['user', userId], (d) => (d ? { user: { ...d.user, isFollowing: following, followerCount } } : d));
      qc.setQueryData(FOLLOWING_IDS, (ids) => {
        if (!ids) return ids;
        const next = new Set(ids);
        if (following) next.add(String(userId));
        else next.delete(String(userId));
        return [...next];
      });
      const me = useAuthStore.getState().user;
      if (me) setUser({ followingCount: Math.max(0, (me.followingCount ?? 0) + (following ? 1 : -1)) });
      qc.invalidateQueries({ queryKey: ['posts', 'feed', 'following'] });
    },
    onError: (e) => toast(e.message, 'error'),
  });
}

export function FollowButton({ userId, isFollowing, className }) {
  const follow = useFollow(userId);
  const me = useAuthStore((s) => s.user);
  const followingIds = useFollowingIds({ enabled: isFollowing === undefined });
  const following = follow.data ? follow.data.following : isFollowing ?? followingIds.has(String(userId));
  if (me?._id === userId) return null;
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        follow.mutate();
      }}
      disabled={follow.isPending}
      className={cn(
        following
          ? 'btn-secondary hover:border-danger hover:text-danger [&:hover>.a]:hidden [&:not(:hover)>.b]:hidden'
          : 'btn bg-primary text-on-primary hover:bg-primary-hover',
        'px-4 py-1.5',
        className
      )}
    >
      {following ? (
        <>
          <span className="a">Following</span>
          <span className="b">Unfollow</span>
        </>
      ) : (
        'Follow'
      )}
    </button>
  );
}

/** "120 followers · 8 cases" for suggestion rows (empty when both are 0). */
export const userStats = (user) =>
  [user.followerCount ? `${compact(user.followerCount)} ${user.followerCount === 1 ? 'follower' : 'followers'}` : null, user.caseCount ? `${compact(user.caseCount)} ${user.caseCount === 1 ? 'case' : 'cases'}` : null]
    .filter(Boolean)
    .join(' · ');

/** `showStats`: Who to follow rows - the reason they're suggested ("Top in Pharmacology"), else their counts. */
export default function UserRow({ user, showBio = false, showStats = false }) {
  const stats = showStats ? user.reason || userStats(user) : '';
  return (
    <Link
      to={`/profile/${user._id}`}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
    >
      <Avatar user={user} size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[15px] font-semibold leading-5">
          <span className="truncate">{user.name}</span> <Tick user={user} />
        </p>
        <p className="muted truncate text-[15px] leading-5">
          {user.username && `@${user.username} · `}
          {userTitle(user)}
        </p>
        {user.institution && <p className="muted truncate text-[13px] leading-5">{user.institution}</p>}
        {stats && <p className={cn('ds-num truncate text-[13px] leading-5', user.reason ? 'font-medium text-ds-brand-text' : 'text-ds-fg-3')}>{stats}</p>}
        {showBio && user.bio && <p className="mt-1 line-clamp-2 text-[13px]">{user.bio}</p>}
      </div>
      <FollowButton userId={user._id} />
    </Link>
  );
}
