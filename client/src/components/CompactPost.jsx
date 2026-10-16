import { Link } from 'react-router-dom';
import { MessageCircle, Heart } from 'lucide-react';
import Avatar from './Avatar';
import { TypeBadge, postTitle } from './PostCard';
import { specialtyMeta, wardOf } from '../lib/specialties';
import { cn, timeAgo, stripMentions } from '../lib/format';

/** Where a post opens: cases go to Case Rounds, everything else to the post page. */
export const postHref = (post) => (post.type === 'case_study' ? `/cases/${post._id}` : `/post/${post._id}`);

/**
 * One-line-ish summary of a post for lists ("New in your Wards", Ward tabs): the Ward's coloured
 * icon, type badge, headline and who/when.
 */
export default function CompactPost({ post, showWard = true, className }) {
  const ward = wardOf(post);
  const m = specialtyMeta(ward ?? post.tags?.[0] ?? '');
  const title = postTitle(post) || stripMentions(post.content || '');
  return (
    <Link to={postHref(post)} className={cn('flex gap-3 px-4 py-3 transition hover:bg-surface-2/70', className)}>
      {showWard && (
        <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', m.soft)} title={m.label}>
          <m.icon className="h-[18px] w-[18px]" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge post={post} />
          {showWard && ward && <span className="muted text-[12px] font-semibold">{m.short}</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug">{title || 'Image post'}</p>
        <div className="muted mt-1 flex items-center gap-1.5 text-[12px]">
          <Avatar user={post.author} size="xs" className="!h-4 !w-4 text-[8px]" />
          <span className="truncate">{post.author?.name}</span>
          <span>· {timeAgo(post.createdAt)}</span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-0.5"><Heart className="h-3.5 w-3.5" /> {post.likeCount}</span>
            <span className="flex items-center gap-0.5"><MessageCircle className="h-3.5 w-3.5" /> {post.commentCount}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
