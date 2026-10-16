import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Repeat2 } from 'lucide-react';
import { api } from '../api/client';
import Avatar from './Avatar';
import { Tick } from './VerificationBadge';
import { RichText, postTitle } from './PostCard';
import { PageLoader } from './ui';
import { userTitle } from '../lib/constants';
import { timeAgo, stripMentions, cn } from '../lib/format';

/** A comment shown outside its post (Saved, profile Reposts): X-style, with "Replying to …". */
function CommentRow({ c, repostedBy }) {
  const navigate = useNavigate();
  const post = c.post;
  const about = postTitle(post) || stripMentions(post?.content || '').slice(0, 80);
  const to = `/post/${post?._id}#comment-${c._id}`;
  return (
    <article
      onClick={(e) => !e.target.closest('a,button') && navigate(to)}
      className="cursor-pointer px-4 py-3 transition hover:bg-surface-2"
    >
      {repostedBy && (
        <p className="muted mb-1 ml-8 flex items-center gap-1.5 text-[13px] font-semibold">
          <Repeat2 className="h-4 w-4" /> {repostedBy} reposted
        </p>
      )}
      <div className="flex gap-3">
        <Link to={`/profile/${c.author?._id}`} className="shrink-0" aria-label={`${c.author?.name ?? "Deleted user"}'s profile`}>
          <Avatar user={c.author} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1 text-[15px] leading-5">
            <Link to={`/profile/${c.author?._id}`} className="truncate font-semibold hover:underline">{c.author?.name ?? 'Deleted user'}</Link>
            <Tick user={c.author} />
            <span className="muted truncate">
              {c.author?.role && <span className="hidden sm:inline">{userTitle(c.author)} · </span>}
              {timeAgo(c.createdAt)}
            </span>
          </p>
          <p className="muted truncate text-[15px]">
            Replying to <span className="text-link">{post?.author?.name ?? 'a post'}</span>
            {about && <> · {about}</>}
          </p>
          <RichText text={c.text} className="mt-0.5 text-[15px]" />
        </div>
      </div>
    </article>
  );
}

/** Loads and lists comments from `url` (saved or reposted), or shows nothing/empty. */
export default function CommentList({ queryKey, url, repostedBy, empty, className }) {
  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => api.get(url).then((r) => r.data.comments),
  });
  if (isPending) return <PageLoader />;
  if (!data?.length) return empty ?? null;
  return (
    <div className={cn('divide-y divide-line border-b border-line', className)}>
      {data.map((c) => <CommentRow key={c._id} c={c} repostedBy={repostedBy} />)}
    </div>
  );
}
