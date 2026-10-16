import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, MessageCircle, Heart, AtSign, BarChart2, Bookmark, Share, Flag } from 'lucide-react';
import { Action, RepostMenu } from './PostActions';

// toggle name -> [flag field, count field] on a serialized comment
const COMMENT_TOGGLES = {
  like: ['liked', 'likeCount'],
  repost: ['reposted', 'repostCount'],
  bookmark: ['bookmarked', 'bookmarkCount'],
};
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast, useUIStore } from '../store/ui';
import { patchPost } from '../hooks/usePosts';
import { useSeen } from '../hooks/useSeen';
import { timeAgo, fullDate, cn } from '../lib/format';
import Avatar from './Avatar';
import VerificationBadge from './VerificationBadge';
import { EmptyState, Modal } from './ui';
import MentionTextarea from './MentionTextarea';
import { RichText } from './PostCard';
import PrivacyWarning, { hasPrivacyIssues, PrivacyReviewBanner } from './PrivacyWarning';

/** Text box shared by new comments and replies. */
function CommentForm({ me, onSubmit, pending, placeholder, submitLabel, onCancel, autoFocus, compact }) {
  const [text, setText] = useState('');
  const privacyBlocked = hasPrivacyIssues([text]);
  const submit = (e) => {
    e.preventDefault();
    if (text.trim() && !privacyBlocked) onSubmit(text.trim(), () => setText(''));
  };
  return (
    <form onSubmit={submit} className="flex gap-3">
      <Avatar user={me} size={compact ? 'xs' : 'sm'} />
      <div className="flex-1">
        <MentionTextarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e);
            if (e.key === 'Escape' && onCancel) onCancel();
          }}
          rows={compact ? 1 : 2}
          maxLength={2000}
          placeholder={placeholder}
          className="input resize-none"
          aria-label={placeholder}
          autoFocus={autoFocus}
        />
        <PrivacyWarning fields={[{ text, onChange: setText }]} className="mt-2" />
        <div className="mt-2 flex items-center justify-between gap-2">
          {compact ? <span /> : <p className="muted text-[12px]">Keep patient details out of comments.</p>}
          <div className="flex gap-2">
            {onCancel && (
              <button type="button" className="btn-ghost px-3 py-1.5 text-[13px]" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button className="btn-primary px-4 py-1.5" disabled={!text.trim() || pending || privacyBlocked}>
              {pending ? 'Posting…' : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * X-style icon row under a comment: reply, repost, like, views, save, share.
 * Liking your own comment isn't offered (you see how many liked it instead).
 */
function CommentActions({ c, me, postId, replyCount, onReply, onToggle }) {
  const own = c.author?._id === me?._id;
  const openComposer = useUIStore((s) => s.openComposer);
  const share = async () => {
    const url = `${window.location.origin}/post/${postId}#comment-${c._id}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Tectum', url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      /* share dismissed */
    }
  };
  return (
    <div className="-ml-1.5 mt-1 flex max-w-md items-center justify-between">
      <Action
        icon={MessageCircle}
        count={replyCount}
        label={onReply ? 'Reply' : 'Replies'}
        onClick={() => onReply?.(c)}
        disabled={!onReply}
        hoverClass="hover:text-link"
      />
      <RepostMenu
        count={(c.repostCount ?? 0) + (c.quoteCount ?? 0)}
        reposted={c.reposted}
        onRepost={() => onToggle(c._id, 'repost')}
        onQuote={() => openComposer('text', { quote: c, quoteKind: 'comment' })}
      />
      <Action
        icon={Heart}
        count={c.likeCount ?? 0}
        active={c.liked}
        fill
        label={own ? 'Likes' : c.liked ? 'Unlike' : 'Like'}
        onClick={() => !own && onToggle(c._id, 'like')}
        activeClass="text-ds-accent-text"
        hoverClass={own ? '' : 'hover:text-ds-accent-text'}
      />
      <Action icon={BarChart2} count={c.views ?? 0} label="Views" hoverClass="hover:text-link" />
      <div className="flex items-center">
        <Action
          icon={Bookmark}
          active={c.bookmarked}
          fill
          label={c.bookmarked ? 'Unsave' : 'Save'}
          onClick={() => onToggle(c._id, 'bookmark')}
          activeClass="text-link"
          hoverClass="hover:text-link"
        />
        <Action icon={Share} label="Share" onClick={share} hoverClass="hover:text-link" />
      </div>
    </div>
  );
}

/** Flag button on someone else's comment: optional reason, then it goes to the moderators. */
function ReportCommentButton({ postId, comment }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const send = useMutation({
    mutationFn: () => api.post(`/posts/${postId}/comments/${comment._id}/report`, { reason: reason.trim() }).then((r) => r.data),
    onSuccess: (d) => {
      toast(d.message);
      setOpen(false);
      setReason('');
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full p-1.5 text-ds-fg-3 hover:bg-surface-2 hover:text-danger" title="Report" aria-label="Report comment">
        <Flag className="h-4 w-4" />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Report comment"
        size="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-danger" onClick={() => send.mutate()} disabled={send.isPending}>{send.isPending ? 'Sending…' : 'Report'}</button>
          </div>
        }
      >
        <div className="space-y-2 p-5">
          <label className="label" htmlFor={`report-${comment._id}`}>What's wrong with it? <span className="muted font-normal">(optional)</span></label>
          <textarea
            id={`report-${comment._id}`}
            className="input"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Patient details, harassment, dangerous advice, spam"
          />
          <p className="muted text-[13px]">They won't be told who reported them.</p>
        </div>
      </Modal>
    </>
  );
}

function CommentItem({ c, me, postId, isReply, replyCount, onReply, onDelete, onToggle }) {
  const seenRef = useSeen('comment', c._id);
  return (
    <div ref={seenRef} id={`comment-${c._id}`} className="flex scroll-mt-24 gap-3">
      <Link to={`/profile/${c.author?._id}`} className="shrink-0" aria-label={`${c.author?.name ?? "Deleted user"}'s profile`}>
        <Avatar user={c.author} size={isReply ? 'xs' : 'sm'} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Link to={`/profile/${c.author?._id}`} className="truncate text-[13px] font-semibold hover:underline">
              {c.author?.name ?? 'Deleted user'}
            </Link>
            <VerificationBadge user={c.author} />
            <time className="muted text-[12px]" title={fullDate(c.createdAt)}>
              {timeAgo(c.createdAt)}
            </time>
          </div>
          {(c.author?._id === me?._id || me?.isAdmin) && (
            <button
              onClick={() => window.confirm(isReply ? 'Delete this reply?' : 'Delete this comment and its replies?') && onDelete(c._id)}
              className="rounded-full p-1.5 text-ds-fg-3 hover:bg-danger-soft hover:text-danger"
              title="Delete"
              aria-label="Delete comment"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
          {me && c.author?._id !== me._id && <ReportCommentButton postId={postId} comment={c} />}
        </div>
        <RichText text={c.text} className="mt-0.5 text-[15px] leading-[23px]" />
        {c.author?._id === me?._id && (
          <PrivacyReviewBanner
            review={c.privacyReview}
            kind="comment"
            className="mt-2"
            action={
              <button className="rounded-full bg-warning px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-warning" onClick={() => onDelete(c._id)}>
                Delete comment
              </button>
            }
          />
        )}
        {me && <CommentActions c={c} me={me} postId={postId} replyCount={replyCount} onReply={onReply} onToggle={onToggle} />}
      </div>
    </div>
  );
}

export default function CommentThread({ postId, comments, canReply = true, replyNote }) {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  // { thread: top-level comment id, target: the comment being answered }
  const [replying, setReplying] = useState(null);
  const detailKey = ['post', postId];

  const add = useMutation({
    mutationFn: ({ text, parentId }) => api.post(`/posts/${postId}/comments`, { text, parentId }).then((r) => r.data.comment),
    onSuccess: (comment) => {
      qc.setQueryData(detailKey, (d) => (d ? { ...d, comments: [...d.comments, comment] } : d));
      patchPost(qc, postId, (p) => ({ commentCount: (p.commentCount ?? 0) + 1 }));
      qc.invalidateQueries({ queryKey: ['activity'] }); // study progress: answers
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/posts/${postId}/comments/${id}`).then((r) => ({ id, removed: r.data.removed ?? 1 })),
    onSuccess: ({ id, removed }) => {
      qc.setQueryData(detailKey, (d) =>
        d ? { ...d, comments: d.comments.filter((c) => c._id !== id && c.parent !== id) } : d
      );
      patchPost(qc, postId, (p) => ({ commentCount: Math.max(0, (p.commentCount ?? removed) - removed) }));
      if (replying?.thread === id) setReplying(null);
    },
    onError: (e) => toast(e.message, 'error'),
  });

  // Like / repost / save flip instantly, then settle on the server's numbers (or roll back on error).
  const setComment = (id, patch) =>
    qc.setQueryData(detailKey, (d) =>
      d ? { ...d, comments: d.comments.map((c) => (c._id === id ? { ...c, ...patch(c) } : c)) } : d
    );
  const toggle = useMutation({
    mutationFn: ({ id, kind }) => api.post(`/posts/${postId}/comments/${id}/${kind}`).then((r) => r.data),
    onMutate: ({ id, kind }) => {
      const [flag, count] = COMMENT_TOGGLES[kind];
      const before = qc.getQueryData(detailKey)?.comments.find((c) => c._id === id);
      setComment(id, (c) => ({ [flag]: !c[flag], [count]: Math.max(0, (c[count] ?? 0) + (c[flag] ? -1 : 1)) }));
      return { before };
    },
    onSuccess: ({ active, count: n }, { id, kind }) => {
      const [flag, count] = COMMENT_TOGGLES[kind];
      setComment(id, () => ({ [flag]: active, [count]: n }));
      if (kind === 'bookmark') qc.invalidateQueries({ queryKey: ['saved-comments'] });
      if (kind === 'repost') qc.invalidateQueries({ queryKey: ['reposted-comments'] });
    },
    onError: (e, { id, kind }, ctx) => {
      const [flag, count] = COMMENT_TOGGLES[kind];
      if (ctx?.before) setComment(id, () => ({ [flag]: ctx.before[flag], [count]: ctx.before[count] }));
      toast(e.message, 'error');
    },
  });
  const onToggle = (id, kind) => toggle.mutate({ id, kind });

  // Group replies under their top-level comment; a reply whose parent is gone shows on its own.
  const ids = new Set(comments.map((c) => c._id));
  const topLevel = comments.filter((c) => !c.parent || !ids.has(c.parent));
  const repliesOf = (id) => comments.filter((c) => c.parent === id);

  const startReply = (thread) => (c) => setReplying({ thread, target: c });

  return (
    <section id="comments">
      <div className="border-y border-line px-4 py-3">
        {replyNote && (
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-link">
            <AtSign className="h-4 w-4" strokeWidth={1.5} /> {replyNote}
          </p>
        )}
        {canReply ? (
          <CommentForm
            me={me}
            pending={add.isPending && !add.variables?.parentId}
            placeholder="Post your reply"
            submitLabel="Reply"
            onSubmit={(text, clear) => add.mutate({ text }, { onSuccess: clear })}
          />
        ) : (
          <p className="muted text-[15px]">The author has limited who can reply to this post.</p>
        )}
      </div>

      {comments.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No comments yet">
          Start the discussion. Share a differential, a question or a reference.
        </EmptyState>
      ) : (
        <ul>
          {topLevel.map((c) => {
            const replies = repliesOf(c._id);
            const open = replying?.thread === c._id;
            return (
              <li key={c._id} className="border-b border-line px-4 py-3 last:border-b-0">
                <CommentItem
                  c={c}
                  me={me}
                  postId={postId}
                  replyCount={replies.length}
                  onReply={canReply ? startReply(c._id) : undefined}
                  onDelete={remove.mutate}
                  onToggle={onToggle}
                />

                {(replies.length > 0 || open) && (
                  // replies hang off a thin nesting line under the parent's avatar
                  <div className="ml-4 mt-3 space-y-3 border-l border-line-strong pl-4 sm:ml-[18px] sm:pl-[30px]">
                    {replies.map((r) => (
                      <CommentItem
                        key={r._id}
                        c={r}
                        me={me}
                        postId={postId}
                        isReply
                        replyCount={0}
                        onReply={canReply ? startReply(c._id) : undefined}
                        onDelete={remove.mutate}
                        onToggle={onToggle}
                      />
                    ))}
                    {open && (
                      <div className={cn(replies.length > 0 && 'pt-1')}>
                        <CommentForm
                          key={replying.target._id}
                          me={me}
                          compact
                          autoFocus
                          pending={add.isPending && add.variables?.parentId === replying.target._id}
                          placeholder={`Reply to ${replying.target.author?.name ?? 'this comment'}…`}
                          submitLabel="Reply"
                          onCancel={() => setReplying(null)}
                          onSubmit={(text, clear) =>
                            add.mutate(
                              { text, parentId: replying.target._id },
                              { onSuccess: () => { clear(); setReplying(null); } }
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
