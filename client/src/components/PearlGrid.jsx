import { useState } from 'react';
import { Bookmark, Heart, MessageCircle } from 'lucide-react';
import { cldUrl, cldSrcSet } from '../lib/cldUrl';
import { usePostFeed, useAutoLoadMore } from './InfiniteFeed';
import { useTogglePost } from '../hooks/usePosts';
import Avatar from './Avatar';
import { RolePill } from './VerificationBadge';
import SensitiveContentOverlay from './SensitiveContentOverlay';
import { TypeBadge, SpecialtyPill, postTitle } from './PostCard';
import PostModal from './PostModal';
import { EmptyState, ErrorState, Spinner } from './ui';
import { specialtyMeta, wardOf } from '../lib/specialties';
import { cn, stripMentions } from '../lib/format';

/** One tile: picture (if any), badges, the pearl itself, who shared it, and a save button. */
export function PearlTile({ post, onOpen }) {
  const toggle = useTogglePost();
  const ward = wardOf(post) ?? post.tags?.[0];
  const m = specialtyMeta(ward ?? '');
  const text = postTitle(post) || stripMentions(post.content || '');
  const img = post.images?.[0];
  const open = (e) => {
    if (e.target.closest('a,button')) return;
    onOpen(post._id);
  };
  return (
    <article
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(post._id)}
      tabIndex={0}
      role="button"
      aria-label={`Open: ${text.slice(0, 60)}`}
      className="card mb-3 cursor-pointer break-inside-avoid overflow-hidden transition hover:-translate-y-0.5 hover:"
    >
      <div className={cn('h-1', m.solid)} />
      {img && (
        <SensitiveContentOverlay sensitive={post.isSensitiveContent}>
          <img src={cldUrl(img, { w: 400, crop: 'limit', dpr: 1 })} srcSet={cldSrcSet(img, [300, 600, 900])} sizes="(min-width: 640px) 300px, 50vw" alt="" loading="lazy" className="max-h-80 w-full bg-surface-2 object-cover" />
        </SensitiveContentOverlay>
      )}
      <div className="p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge post={post} />
          <SpecialtyPill tag={ward} />
        </div>
        {text && <p className={cn('mt-2 whitespace-pre-wrap break-words text-[15px] leading-snug', img ? 'line-clamp-3' : 'line-clamp-[8]', post.kind === 'pearl' && 'font-semibold')}>{text}</p>}
        <div className="mt-3 flex items-center gap-2">
          <Avatar user={post.author} size="xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-4">{post.author?.name}</p>
            <RolePill user={post.author} className="mt-0.5" />
          </div>
          <span className="muted flex items-center gap-2 text-[12px]">
            <span className="flex items-center gap-0.5"><Heart className="h-3.5 w-3.5" />{post.likeCount}</span>
            <span className="flex items-center gap-0.5"><MessageCircle className="h-3.5 w-3.5" />{post.commentCount}</span>
          </span>
          <button
            onClick={() => toggle.mutate({ id: post._id, action: 'bookmark' })}
            className={cn('rounded-[6px] p-1.5 transition hover:bg-surface-2', post.bookmarked ? 'text-link' : 'text-ds-fg-3')}
            aria-label={post.bookmarked ? 'Remove from Notebook' : 'Save to Notebook'}
            aria-pressed={post.bookmarked}
            title={post.bookmarked ? 'Saved in your Notebook' : 'Save to Notebook'}
          >
            <Bookmark className={cn('h-[18px] w-[18px]', post.bookmarked && 'fill-current')} />
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * Masonry grid of pearls and picture posts (ECGs, X-rays, slides). Tapping a tile opens it in a
 * pop-up with its comments. `params` go to GET /posts; `grid: true` is added.
 */
export default function PearlGrid({ queryKey, params = {}, empty }) {
  const query = usePostFeed({ queryKey, params: { ...params, grid: true }, limit: 18 });
  const sentinel = useAutoLoadMore(query);
  const [openId, setOpenId] = useState(null);

  if (query.isPending) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (query.isError) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;
  const posts = query.data.pages.flatMap((p) => p.posts);
  if (!posts.length) return <div className="card">{empty ?? <EmptyState icon={Bookmark} title="No pearls yet" />}</div>;

  return (
    <>
      <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
        {posts.map((p) => <PearlTile key={p._id} post={p} onOpen={setOpenId} />)}
      </div>
      <div ref={sentinel} className="flex justify-center py-4">
        {query.isFetchingNextPage ? <Spinner /> : !query.hasNextPage ? <p className="muted text-[12px]">You're all caught up.</p> : null}
      </div>
      <PostModal postId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
