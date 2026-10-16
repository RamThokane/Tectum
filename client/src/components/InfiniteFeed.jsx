import { Fragment, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { api } from '../api/client';
import { useInView } from '../hooks/useInView';
import PostCard from './PostCard';
import { EmptyState, ErrorState, Spinner } from './ui';
import { FeedSkeleton } from './Skeleton';
import { useAds, SponsoredFeedItem } from './Ads';

/**
 * Paginated post list with infinite scroll.
 * `queryKey` must start with 'posts' so post mutations can patch it in place.
 */
export function usePostFeed({ queryKey, url = '/posts', params = {}, enabled = true, limit = 10 }) {
  return useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get(url, { params: { ...params, page: pageParam, limit } }).then((r) => r.data),
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });
}

export function useAutoLoadMore(query) {
  const [ref, inView] = useInView();
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);
  return ref;
}

/**
 * One continuous surface for a list of posts, with a hairline between each (Twitter-style)
 * instead of a separate floating box per post.
 */
// Posts stack edge to edge, separated by hairlines (X-style); no surrounding box.
export const FEED_SURFACE = 'divide-y divide-line border-b border-line';

/**
 * A stack of posts. `variant="cards"` puts them all in one rounded panel on the page background
 * (the home feed, My Notebook), back to back; the default lists them edge to edge.
 * `adsEvery` slots a "Promoted" item in after every N posts.
 */
export default function InfiniteFeed({ queryKey, url, params, empty, renderItem, adsEvery = 0, variant = 'list', header = null }) {
  const asCards = variant === 'cards';
  const query = usePostFeed({ queryKey, url, params });
  const sentinel = useAutoLoadMore(query);
  const ads = useAds('feed', 3, adsEvery > 0);

  if (query.isPending) return asCards ? <div className="card overflow-clip divide-y divide-line">{header}<FeedSkeleton /></div> : <FeedSkeleton />;
  if (query.isError) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;

  const posts = query.data.pages.flatMap((p) => p.posts);
  if (posts.length === 0) {
    return <div className="card overflow-clip divide-y divide-line">{header}<div>{empty ?? <EmptyState icon={Inbox} title="Nothing here yet" />}</div></div>;
  }

  return (
    <div>
      {/* cards: one rounded panel, posts back to back with no gap between them */}
      <div className={asCards ? 'card overflow-clip divide-y divide-line' : FEED_SURFACE}>
        {/* optional pinned items at the top of the same list (Home: Case of the Day, revision) */}
        {header}
        {posts.map((post, i) => {
          const item = renderItem ? renderItem(post) : <PostCard post={post} />;
          const slot = adsEvery && ads.length && (i + 1) % adsEvery === 0 ? ads[((i + 1) / adsEvery - 1) % ads.length] : null;
          return (
            <Fragment key={post._id}>
              {item}
              {slot && <SponsoredFeedItem ad={slot} />}
            </Fragment>
          );
        })}
      </div>
      <div ref={sentinel} className="flex justify-center py-4">
        {query.isFetchingNextPage ? (
          <Spinner />
        ) : !query.hasNextPage ? (
          <p className="muted text-[12px]">You're all caught up.</p>
        ) : null}
      </div>
    </div>
  );
}
