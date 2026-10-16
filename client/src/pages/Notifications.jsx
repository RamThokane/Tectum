import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BellOff, CheckCheck } from 'lucide-react';
import { api } from '../api/client';
import { PageShell } from '../components/Layout';
import NotificationItem from '../components/NotificationItem';
import { useAutoLoadMore } from '../components/InfiniteFeed';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../components/ui';

const KEY = ['notifications', 'list'];

/** Today / This week / Earlier, in order, each with its notifications (already newest first). */
function groupByAge(items) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 6 * 86400000;
  const groups = [
    { id: 'today', label: 'Today', items: [] },
    { id: 'week', label: 'This week', items: [] },
    { id: 'earlier', label: 'Earlier', items: [] },
  ];
  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    groups[t >= startOfToday ? 0 : t >= weekAgo ? 1 : 2].items.push(n);
  }
  return groups.filter((g) => g.items.length);
}

export default function Notifications() {
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: KEY,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get('/notifications', { params: { page: pageParam, limit: 20 } }).then((r) => r.data),
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });
  const sentinel = useAutoLoadMore(query);

  const markLocal = (predicate) =>
    qc.setQueryData(KEY, (d) =>
      d && { ...d, pages: d.pages.map((p) => ({ ...p, notifications: p.notifications.map((n) => (predicate(n) ? { ...n, isRead: true } : n)) })) }
    );

  const readOne = useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}/read`),
    onMutate: (id) => markLocal((n) => n._id === id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications', 'unread'] }),
  });

  const readAll = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onMutate: () => markLocal(() => true),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications', 'unread'] }),
  });

  const items = query.data?.pages.flatMap((p) => p.notifications) ?? [];
  const unread = query.data?.pages[0]?.unreadCount ?? 0;

  return (
    <PageShell
      title="Notifications"
      actions={
        unread > 0 && (
          <button className="btn-ghost text-[13px] text-link!" onClick={() => readAll.mutate()} aria-label="Mark all notifications as read">
            <CheckCheck className="h-4 w-4" strokeWidth={1.75} /> <span className="hidden sm:inline">Mark all read</span>
          </button>
        )
      }
    >
      {query.isPending ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications yet">
          When people like, comment on, repost or save your posts, or follow you, you'll see it here.
        </EmptyState>
      ) : (
        groupByAge(items).map((g) => (
          <section key={g.id} aria-labelledby={`notif-${g.id}`}>
            <h2 id={`notif-${g.id}`} className="ds-eyebrow border-b border-line px-4 pb-2 pt-4 sm:px-5">
              {g.label}
              {g.items.some((n) => !n.isRead) && (
                <span className="ds-num ml-2 font-medium normal-case tracking-normal text-ds-accent-text">{g.items.filter((n) => !n.isRead).length} new</span>
              )}
            </h2>
            <div className="divide-y divide-line">
              {g.items.map((n) => <NotificationItem key={n._id} notification={n} onRead={(id) => readOne.mutate(id)} />)}
            </div>
          </section>
        ))
      )}
      <div ref={sentinel} className="flex justify-center py-4">
        {query.isFetchingNextPage && <Spinner />}
      </div>
    </PageShell>
  );
}
