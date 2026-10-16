import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Flag,
  Link2,
  Frown,
  UserPlus,
  UserMinus,
  Bookmark,
  BookmarkMinus,
  VolumeX,
  Volume2,
  Ban,
  BarChart3,
  Code2,
  Megaphone,
  Eye,
  Heart,
  Repeat2,
  Quote,
  MessageCircle,
  Vote,
  Pin,
  PinOff,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useDeletePost, useReportPost, useTogglePost, removePost } from '../hooks/usePosts';
import { useFollow, useFollowingIds } from './UserRow';
import { toast } from '../store/ui';
import { Modal } from './ui';
import EditPostModal from './EditPostModal';
import { postTitle } from './PostCard';
import { CASE_OF_THE_DAY, fetchCaseOfTheDay } from '../hooks/useCaseOfTheDay';
import { cn, stripMentions } from '../lib/format';

const MENU_W = 300;

/** The numbers behind a post (X's "View post activity"). */
function ActivityModal({ post, onClose }) {
  const rows = [
    { icon: Eye, label: 'Views', value: post.views ?? 0, hint: 'Members who saw this post on screen, each counted at most once a day (your own views never count)' },
    { icon: Heart, label: 'Likes', value: post.likeCount ?? 0 },
    { icon: Repeat2, label: 'Reposts', value: post.repostCount ?? 0 },
    { icon: Quote, label: 'Quotes', value: post.quoteCount ?? 0 },
    { icon: Bookmark, label: 'Saved to Notebooks', value: post.bookmarkCount ?? 0 },
    { icon: MessageCircle, label: 'Comments', value: post.commentCount ?? 0 },
    ...(post.poll ? [{ icon: Vote, label: 'Diagnosis poll votes', value: post.poll.total }] : []),
  ];
  const views = post.views ?? 0;
  const engaged = (post.likeCount ?? 0) + (post.repostCount ?? 0) + (post.commentCount ?? 0) + (post.bookmarkCount ?? 0);
  return (
    <Modal open onClose={onClose} title="Post activity" size="max-w-md">
      <div className="p-5">
        <p className="muted line-clamp-2 text-[13px]">{postTitle(post) || stripMentions(post.content || '')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {rows.map((r) => (
            <div key={r.label} className="rounded-[12px] border border-line p-3" title={r.hint}>
              <p className="muted flex items-center gap-1.5 text-[12px] font-semibold"><r.icon className="h-4 w-4" /> {r.label}</p>
              <p className="mt-1 text-[28px] font-semibold ds-num">{r.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
        {views > 0 && (
          <p className="muted mt-4 text-[13px]">
            Engagement rate: <span className="font-semibold text-ink">{Math.round((engaged / views) * 1000) / 10}%</span> of views led to a like, repost, comment or save.
          </p>
        )}
      </div>
    </Modal>
  );
}

/** HTML snippet another site can paste in to show this post, with a link back. */
function embedCode(post) {
  const url = `${window.location.origin}/post/${post._id}`;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const text = esc((postTitle(post) || stripMentions(post.content || '')).slice(0, 280));
  const who = esc(post.author?.name ?? 'Tectum member');
  const when = new Date(post.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  return `<blockquote class="tectum-post" style="border-left:4px solid #1a66d8;padding:8px 16px;font-family:sans-serif"><p>${text}</p>&mdash; ${who} on <a href="${url}">Tectum</a>, ${when}</blockquote>`;
}

/**
 * The "…" menu on a post (like X's): copy link, not interested, follow, save to Notebook, mute,
 * block, activity, embed, report and request a correction. Authors get edit / delete instead.
 */
export default function PostMenu({ post, onDeleted }) {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [pos, setPos] = useState(null); // where the open menu is drawn, or null when closed
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(null); // null | 'report' | 'correction'
  const [activity, setActivity] = useState(false);
  const [reason, setReason] = useState('');
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const del = useDeletePost({ onDeleted });
  const report = useReportPost();
  const toggle = useTogglePost();
  const author = post.author;
  const authorId = author?._id;
  const isOwner = me?._id === authorId;
  const follow = useFollow(authorId);
  const handle = author?.name ?? 'this member';
  const open = Boolean(pos);

  // Mute / block state lives on the author's profile, so load it when the menu opens.
  const { data: profile } = useQuery({
    queryKey: ['user', authorId],
    queryFn: () => api.get(`/users/${authorId}`).then((r) => r.data),
    enabled: open && Boolean(authorId) && !isOwner,
    staleTime: 60_000,
  });
  const rel = profile?.user;

  // Admins choose the Case of the Day from any case's menu (members never see this).
  const canPin = Boolean(me?.isAdmin) && post.type === 'case_study';
  const { data: cotd } = useQuery({ queryKey: CASE_OF_THE_DAY, queryFn: fetchCaseOfTheDay, enabled: open && canPin, staleTime: 5 * 60_000 });
  const isCotd = cotd?.pinnedId === post._id;
  const pin = useMutation({
    mutationFn: (postId) => api.put('/posts/case-of-the-day', { postId }).then((r) => r.data),
    onSuccess: (d) => {
      toast(d.message);
      qc.invalidateQueries({ queryKey: CASE_OF_THE_DAY });
    },
    onError: (e) => toast(e.message, 'error'),
  });
  const followingIds = useFollowingIds({ enabled: open && !isOwner });
  const following = follow.data ? follow.data.following : rel?.isFollowing ?? followingIds.has(String(authorId));

  const close = () => setPos(null);
  const openMenu = () => {
    if (open) return close();
    const r = btnRef.current.getBoundingClientRect();
    setPos({ right: Math.max(8, window.innerWidth - r.right), top: r.bottom + 4, anchorTop: r.top });
  };

  // Flip the menu above the button if it would run off the bottom of the screen.
  useLayoutEffect(() => {
    if (!pos || pos.flipped || !menuRef.current) return;
    const h = menuRef.current.offsetHeight;
    if (pos.top + h > window.innerHeight - 8) {
      setPos((p) => ({ ...p, flipped: true, top: Math.max(8, Math.min(p.anchorTop - h - 4, window.innerHeight - h - 8)) }));
    }
  }, [pos]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target) && close();
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const refreshAuthor = () => {
    qc.invalidateQueries({ queryKey: ['user', authorId] });
    qc.invalidateQueries({ queryKey: ['posts'] });
  };

  const notInterested = useMutation({
    mutationFn: () => api.post(`/posts/${post._id}/not-interested`),
    onSuccess: () => {
      removePost(qc, post._id);
      toast("Got it. You won't see this post in your feeds.");
    },
    onError: (e) => toast(e.message, 'error'),
  });
  const mute = useMutation({
    mutationFn: () => api.post(`/users/${authorId}/mute`).then((r) => r.data),
    onSuccess: ({ muted }) => {
      toast(muted ? `Muted ${handle}. Their posts won't show in your feeds.` : `Unmuted ${handle}`);
      refreshAuthor();
    },
    onError: (e) => toast(e.message, 'error'),
  });
  const block = useMutation({
    mutationFn: () => api.post(`/users/${authorId}/block`).then((r) => r.data),
    onSuccess: ({ blocked }) => {
      toast(blocked ? `Blocked ${handle}` : `Unblocked ${handle}`);
      refreshAuthor();
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const run = (fn) => () => {
    close();
    fn();
  };
  const copy = async (text, done) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(done);
    } catch {
      toast("Couldn't copy. Please try again.", 'error');
    }
  };

  const item = 'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] font-semibold transition hover:bg-surface-2 disabled:opacity-50';
  const icon = 'h-5 w-5 shrink-0';

  const items = [
    canPin && {
      key: 'cotd',
      icon: isCotd ? PinOff : Pin,
      label: isCotd ? 'Remove as Case of the Day' : 'Make Case of the Day',
      onClick: () => pin.mutate(isCotd ? null : post._id),
      disabled: !cotd || pin.isPending,
    },
    !isOwner && { key: 'ni', icon: Frown, label: 'Not interested in this post', onClick: () => notInterested.mutate() },
    !isOwner && !rel?.isBlocked && !rel?.hasBlockedYou && {
      key: 'follow',
      icon: following ? UserMinus : UserPlus,
      label: `${following ? 'Unfollow' : 'Follow'} ${handle}`,
      onClick: () => follow.mutate(),
    },
    {
      key: 'save',
      icon: post.bookmarked ? BookmarkMinus : Bookmark,
      label: post.bookmarked ? 'Remove from Notebook' : 'Save to Notebook',
      onClick: () => toggle.mutate({ id: post._id, action: 'bookmark' }),
    },
    !isOwner && {
      key: 'mute',
      icon: rel?.isMuted ? Volume2 : VolumeX,
      label: `${rel?.isMuted ? 'Unmute' : 'Mute'} ${handle}`,
      onClick: () => mute.mutate(),
      disabled: !rel,
    },
    !isOwner && {
      key: 'block',
      icon: Ban,
      label: `${rel?.isBlocked ? 'Unblock' : 'Block'} ${handle}`,
      onClick: () => {
        if (
          rel?.isBlocked ||
          window.confirm(`Block ${handle}? They won't be able to follow you, reply to your posts or message you, and you'll stop following each other.`)
        ) {
          block.mutate();
        }
      },
      disabled: !rel,
    },
    { key: 'activity', icon: BarChart3, label: 'View post activity', onClick: () => setActivity(true) },
    { key: 'link', icon: Link2, label: 'Copy link', onClick: () => copy(`${window.location.origin}/post/${post._id}`, 'Link copied') },
    { key: 'embed', icon: Code2, label: 'Embed post', onClick: () => copy(embedCode(post), 'Embed code copied. Paste it into your website or blog.') },
    isOwner && { key: 'edit', icon: Pencil, label: 'Edit post', onClick: () => setEditing(true) },
    isOwner && {
      key: 'delete',
      icon: Trash2,
      label: 'Delete post',
      danger: true,
      onClick: () => window.confirm('Delete this post? This cannot be undone.') && del.mutate(post._id),
    },
    !isOwner && { key: 'report', icon: Flag, label: 'Report post', danger: true, onClick: () => setReporting('report') },
    !isOwner && { key: 'correction', icon: Megaphone, label: 'Request a correction', onClick: () => setReporting('correction') },
  ].filter(Boolean);

  const correcting = reporting === 'correction';
  const submitReport = () =>
    report.mutate(
      { id: post._id, reason: correcting ? `Correction requested: ${reason}`.trim() : reason },
      { onSuccess: () => { setReporting(null); setReason(''); } }
    );

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        className="-mr-2 rounded-full p-1.5 text-ds-fg-3 hover:bg-ds-brand-soft hover:text-link"
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, right: pos.right, width: Math.min(MENU_W, window.innerWidth - 16) }}
            className="fixed z-50 overflow-hidden rounded-[12px] border border-line bg-surface py-1.5 shadow-ds-floating"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it) => (
              <button
                key={it.key}
                role="menuitem"
                disabled={it.disabled}
                className={cn(item, it.danger && 'text-danger')}
                onClick={run(it.onClick)}
              >
                <it.icon className={icon} /> <span className="truncate">{it.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}

      {editing && <EditPostModal post={post} onClose={() => setEditing(false)} />}
      {activity && <ActivityModal post={post} onClose={() => setActivity(false)} />}

      <Modal
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        title={correcting ? 'Request a correction' : 'Report post'}
        size="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setReporting(null)}>Cancel</button>
            <button className={correcting ? 'btn-primary' : 'btn-danger'} disabled={report.isPending || (correcting && !reason.trim())} onClick={submitReport}>
              {correcting ? 'Send to moderators' : 'Submit report'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-5">
          {correcting ? (
            <p className="muted text-[13px]">
              Think something in this post is wrong or out of date? Tell our moderators what should be corrected, ideally
              with a source (guideline, textbook or paper). They'll review it and may ask the author to update the post.
            </p>
          ) : (
            <>
              <p className="muted text-[13px]">
                Reports are reviewed by moderators. Please flag posts that contain identifiable patient information,
                misinformation, or inappropriate content.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Identifiable patient info', 'Medical misinformation', 'Copyrighted material', 'Harassment', 'Spam'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium ${reason === r ? 'border-danger bg-danger-soft text-danger' : 'border-line-strong'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}
          <textarea
            className="input"
            rows={correcting ? 4 : 3}
            maxLength={470} // server limit is 500, including the "Correction requested:" prefix
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={correcting ? 'e.g. The adenosine dose is now 6 mg then 12 mg per the 2025 guideline (link)…' : 'Add details (optional)'}
          />
        </div>
      </Modal>
    </div>
  );
}
