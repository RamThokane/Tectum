import { useEffect } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileQuestion, Share2 } from 'lucide-react';
import { api } from '../api/client';
import { toast } from '../store/ui';
import { PageShell, RailCard } from '../components/Layout';
import PostMenu from '../components/PostMenu';
import PostActions from '../components/PostActions';
import CommentThread from '../components/CommentThread';
import { replyNote } from '../components/ReplyPolicy';
import Avatar from '../components/Avatar';
import { Tick } from '../components/VerificationBadge';
import { FollowButton } from '../components/UserRow';
import SpecialtyTagChip from '../components/SpecialtyTagChip';
import {
  AuthorLine,
  Hashtags,
  ImageGrid,
  NotesFileCard,
  QuoteEmbed,
  RichText,
  TypeBadge,
  SpecialtyPill,
  PostPrivacyBanner,
  postCategory,
  postTitle,
} from '../components/PostCard';
import CaseCard from '../components/CaseCard';
import { CollabPill, CollabAction } from '../components/Collab';
import { wardOf } from '../lib/specialties';
import { EmptyState, ErrorState, PageLoader } from '../components/ui';
import NotFoundState from '../components/NotFoundState';
import { useGoBack } from '../hooks/useGoBack';
import { userTitle } from '../lib/constants';
import { timeAgo, stripMentions, truncateWords } from '../lib/format';

function RelatedPosts({ post }) {
  const tag = post.tags?.[0];
  const { data } = useQuery({
    queryKey: ['posts', 'related', post._id, tag],
    queryFn: () => api.get('/posts', { params: { tag, limit: 4 } }).then((r) => r.data.posts),
    enabled: Boolean(tag),
  });
  const items = (data ?? []).filter((p) => p._id !== post._id).slice(0, 3);
  if (!items.length) return null;
  return (
    <RailCard title="Related">
      <ul className="space-y-3">
        {items.map((p) => (
          <li key={p._id}>
            <Link to={`/post/${p._id}`} className="group block">
              <p className="line-clamp-2 text-[15px] font-semibold leading-snug group-hover:underline">{postTitle(p) || stripMentions(p.content)}</p>
              <p className="muted mt-0.5 text-[13px]">{p.author?.name} · {timeAgo(p.createdAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

function Rail({ post, comments }) {
  const contributors = [...new Map(comments.map((c) => [c.author?._id, c.author])).values()].filter(Boolean);
  const author = post.author;
  return (
    <>
      <RailCard title="Posted by">
        <div className="flex items-center gap-3 pb-1">
          <Link to={`/profile/${author?._id}`} aria-label={`${author?.name ?? "Deleted user"}'s profile`}><Avatar user={author} size="md" /></Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-[15px] font-semibold">{author?.name} <Tick user={author} /></p>
            <p className="muted truncate text-[15px]">{userTitle(author)}{author?.institution && ` · ${author.institution}`}</p>
          </div>
          <FollowButton userId={author?._id} />
        </div>
      </RailCard>
      <RelatedPosts post={post} />
      {post.tags?.length > 0 && (
        <RailCard title="Tags">
          <div className="flex flex-wrap gap-1.5 pb-1">
            {post.tags.map((t) => <SpecialtyTagChip key={t} tag={t} />)}
          </div>
        </RailCard>
      )}
      {contributors.length > 0 && (
        <RailCard title="In this discussion">
          <div className="flex -space-x-2">
            {contributors.slice(0, 8).map((u) => (
              <Link key={u._id} to={`/profile/${u._id}`} title={u.name} aria-label={`${u.name}'s profile`}>
                <Avatar user={u} size="sm" className="ring-2 ring-surface" />
              </Link>
            ))}
          </div>
        </RailCard>
      )}
    </>
  );
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get(`/posts/${id}`).then((r) => r.data),
  });

  useEffect(() => {
    if (!data) return;
    if (hash === '#comments') document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
    // shared comment links (#comment-<id>): scroll to it and flash it briefly
    if (hash.startsWith('#comment-')) {
      const el = document.getElementById(hash.slice(1));
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.animate([{ backgroundColor: 'rgb(29 155 240 / 0.15)' }, { backgroundColor: 'transparent' }], { duration: 2000 });
    }
  }, [hash, data]);

  const back = useGoBack('/home');
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Link copied');
    } catch {
      /* ignore */
    }
  };

  if (isPending) return <PageShell><PageLoader /></PageShell>;
  if (isError || !data?.post) {
    return (
      <PageShell>
        {/patient/i.test(error?.response?.data?.message ?? error?.message ?? '') ? (
          <NotFoundState icon={FileQuestion} title="This post is hidden for patient privacy">
            Its author is removing details that could identify a patient. It comes back once that's done.
          </NotFoundState>
        ) : !isError || [400, 404].includes(error?.response?.status) ? (
          <NotFoundState icon={FileQuestion} title="This post doesn't exist">It may have been deleted by its author.</NotFoundState>
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </PageShell>
    );
  }

  const { post, comments } = data;
  const title = postTitle(post);

  return (
    <PageShell bare docTitle={postTitle(post) || truncateWords(stripMentions(post.content || ''), 60) || 'Post'} rail={<Rail post={post} comments={comments} />}>
      {/* "← Case / Post" bar */}
      <div className="sticky top-14 z-20 flex h-[53px] items-center gap-4 border-b border-line bg-surface/95 px-4 backdrop-blur-md md:top-0">
        <button onClick={back} className="-ml-2 rounded-[12px] p-2 hover:bg-surface-2" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-editorial font-medium text-[20px]">{post.type === 'case_study' ? 'Case' : 'Post'}</h1>
      </div>

      {/* post and its discussion run straight into each other */}
      <div>
        <article className="px-4 pb-1 pt-3">
          <div className="flex items-start justify-between gap-3">
            <AuthorLine user={post.author} size="md" />
            <div className="-mr-2 flex items-center">
              <button onClick={share} className="rounded-full p-2 text-ds-fg-3 hover:bg-surface-2" title="Copy link" aria-label="Copy link">
                <Share2 className="h-[18px] w-[18px]" />
              </button>
              <PostMenu post={post} onDeleted={() => navigate('/home', { replace: true })} />
            </div>
          </div>

          <PostPrivacyBanner post={post} className="mt-3" />

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <TypeBadge post={post} />
            <SpecialtyPill tag={wardOf(post) ?? post.tags?.[0]} />
            <CollabPill post={post} />
          </div>

          {post.type === 'case_study' ? (
            <CaseCard post={post} full className="mt-2" />
          ) : (
            <div className="mt-2 space-y-4">
              {title && <h2 className="font-editorial font-medium text-[20px] leading-snug">{title}</h2>}
              <RichText text={post.content} className="text-[17px] leading-6" />
              {post.type === 'notes' && <NotesFileCard file={post.notesFile} postId={post._id} />}
              <ImageGrid images={post.images} sensitive={post.isSensitiveContent} />
              <QuoteEmbed post={post} />
            </div>
          )}

          <Hashtags tags={post.tags} className="mt-3" />
          <p className="muted mt-3 border-b border-line pb-3 text-[15px]">
            {new Date(post.createdAt).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric', year: 'numeric' })}
            {post.tags?.[0] && <> · <span className="capitalize">{postCategory(post)}</span></>}
          </p>
          <CollabAction post={post} className="mt-3" />
          <div className="py-1">
            <PostActions post={post} />
          </div>
        </article>
        <CommentThread postId={id} comments={comments} canReply={post.canReply !== false} replyNote={replyNote(post)} />
      </div>
    </PageShell>
  );
}
