import { Link } from 'react-router-dom';
import { EyeOff, ImageIcon, Layers, Stethoscope } from 'lucide-react';
import { cldUrl } from '../lib/cldUrl';
import { usePostFeed, useAutoLoadMore } from './InfiniteFeed';
import { EmptyState, ErrorState, Skeleton, Spinner } from './ui';

/**
 * A profile's Media tab as a photo grid (3 square tiles across, like a showcase): each tile is
 * the first image of a post; tapping it opens that case or post. Posts with several images show
 * a stack icon, cases a stethoscope. Sensitive images stay blurred until opened.
 */
export default function MediaGrid({ queryKey, url, params, empty }) {
  const query = usePostFeed({ queryKey, url, params, limit: 18 });
  const sentinel = useAutoLoadMore(query);

  if (query.isPending) {
    return (
      <div className="grid grid-cols-3 gap-0.5 sm:gap-1" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-none" />)}
      </div>
    );
  }
  if (query.isError) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;

  const posts = query.data.pages.flatMap((p) => p.posts).filter((p) => p.images?.length);
  if (!posts.length) return empty ?? <EmptyState icon={ImageIcon} title="No media yet" />;

  return (
    <div>
      <ul className="grid grid-cols-3 gap-0.5 sm:gap-1">
        {posts.map((post) => {
          const isCase = post.type === 'case_study';
          const label = post.title || post.caseStudy?.chiefComplaint || post.content || (isCase ? 'Case' : 'Post');
          return (
            <li key={post._id}>
              <Link
                to={`/post/${post._id}`}
                className="ds-focus group relative block aspect-square overflow-hidden bg-surface-2"
                aria-label={`${isCase ? 'Open case' : 'Open post'}: ${label.slice(0, 80)}`}
                title={label.slice(0, 120)}
              >
                <img
                  src={cldUrl(post.images[0], { w: 240, h: 240, gravity: 'auto' })}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${post.isSensitiveContent ? 'scale-110 blur-xl' : ''}`}
                />
                {post.isSensitiveContent && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30 text-[12px] font-medium text-white">
                    <EyeOff className="h-5 w-5" /> Sensitive
                  </span>
                )}
                {/* what the tile is: a case, and/or several photos */}
                <span className="absolute right-1.5 top-1.5 flex gap-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">
                  {isCase && <Stethoscope className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
                  {post.images.length > 1 && <Layers className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div ref={sentinel} className="flex justify-center py-4">
        {query.isFetchingNextPage ? <Spinner /> : !query.hasNextPage ? <p className="muted text-[12px]">That's everything.</p> : null}
      </div>
    </div>
  );
}
