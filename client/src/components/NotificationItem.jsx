import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, UserPlus, Repeat2, BookmarkCheck, AtSign, Reply, PenLine, ShieldAlert, ShieldX, Mail, BadgeCheck, EyeOff, ClipboardCheck } from 'lucide-react';
import Avatar from './Avatar';
import { timeAgo, cn, stripMentions } from '../lib/format';

// Icon by type. All quiet except a like, which carries the coral accent.
const META = {
  like: { icon: Heart, color: 'text-ds-accent-text', fill: true, verb: 'liked your post' },
  comment: { icon: MessageCircle, verb: 'commented on your post' },
  follow: { icon: UserPlus, verb: 'started following you' },
  repost: { icon: Repeat2, verb: 'reposted your post' },
  notes_saved: { icon: BookmarkCheck, verb: 'saved your notes' },
  mention: { icon: AtSign, verb: 'mentioned you' },
  reply: { icon: Reply, verb: 'replied to your comment' },
  quote: { icon: PenLine, verb: 'quoted your post' },
  // No message text: chats are end-to-end encrypted. Opens the chat.
  message: { icon: Mail, color: 'text-ds-brand-text', verb: 'sent you a message' },
  // Notices from Tectum itself (patient privacy check); the text is in `note`.
  privacy_warning: { icon: ShieldAlert, tectum: 'Privacy warning' },
  privacy_removed: { icon: ShieldX, tectum: 'Removed for patient privacy' },
  // The blue-tick decision, and moderation of reported posts/replies.
  verification: { icon: BadgeCheck, tectum: 'Verification' },
  content_hidden: { icon: EyeOff, tectum: 'Hidden after reports' },
  content_removed: { icon: ShieldX, tectum: 'Removed by a moderator' },
  // Tests: the details and code are in `note`; tapping opens `link` (the join page with the code).
  quiz_invite: { icon: ClipboardCheck, color: 'text-ds-brand-text', verb: 'invited you to a test' },
  quiz_update: { icon: ClipboardCheck, color: 'text-ds-brand-text', verb: 'changed the time of a test' },
  // Registration for a listed test: to the host (someone asked), and back (accepted / declined).
  quiz_request: { icon: UserPlus, color: 'text-ds-brand-text', verb: 'asked to take your test' },
  quiz_registration: { icon: ClipboardCheck, color: 'text-ds-brand-text', verb: 'replied to your test registration' },
  // Tectum's decision on an application to conduct quizzes (opens Tests).
  quiz_host: { icon: ClipboardCheck, tectum: 'Quiz hosting' },
};

const postSnippet = (post) =>
  post?.title || stripMentions(post?.content || '') || post?.caseStudy?.chiefComplaint || post?.notesFile?.fileName || '';

const row = (unread, tint) =>
  cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2 sm:px-5', unread && tint);

function Time({ date }) {
  return <time className="ds-num shrink-0 pt-0.5 text-[13px] text-ds-fg-3" dateTime={date}>{timeAgo(date)}</time>;
}

function UnreadDot({ unread }) {
  return unread ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ds-accent" role="img" aria-label="Unread" /> : null;
}

/** One notification: who + what (icon by type on their photo), the post it's about, time, a coral dot while unread. */
export default function NotificationItem({ notification: n, onRead }) {
  const navigate = useNavigate();
  const meta = META[n.type] ?? META.like;
  const Icon = meta.icon;

  const open = () => {
    if (!n.isRead) onRead(n._id);
    if (meta.tectum) {
      if (n.link?.startsWith('/')) return navigate(n.link);
      return n.post && navigate(`/post/${n.post._id}`);
    }
    if (n.type === 'message') return navigate(n.conversation ? `/messages/${n.conversation}` : '/messages');
    // only links inside the site (never an outside address)
    if (n.link?.startsWith('/')) return navigate(n.link);
    navigate(n.post ? `/post/${n.post._id}` : `/profile/${n.sourceUser?._id}`);
  };

  if (meta.tectum) {
    return (
      <button onClick={open} className={row(!n.isRead, 'bg-warning-soft/60')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1 text-[15px] leading-[21px]">
          <p>
            <span className="font-semibold">Tectum</span> · <span className="font-medium text-warning">{meta.tectum}</span>
          </p>
          {n.note && <p className="mt-0.5 text-ds-fg-2">{n.note}</p>}
        </div>
        <Time date={n.createdAt} />
        <UnreadDot unread={!n.isRead} />
      </button>
    );
  }

  const snippet = n.note && n.type.startsWith('quiz_') ? n.note : postSnippet(n.post);
  return (
    <button onClick={open} className={row(!n.isRead, 'bg-ds-brand-soft/50')}>
      <span className="relative shrink-0">
        <Avatar user={n.sourceUser} size="sm" />
        {/* what happened, as a small badge on their photo */}
        <span className={cn('absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface ring-2 ring-surface', meta.color ?? 'text-ds-fg-2')}>
          <Icon className={cn('h-3 w-3', meta.fill && 'fill-current')} strokeWidth={2} />
        </span>
      </span>
      <div className="min-w-0 flex-1 text-[15px] leading-[21px]">
        <p className="text-ds-fg-2">
          <span className="font-semibold text-ink">{n.sourceUser?.name ?? 'Someone'}</span> {meta.verb}
        </p>
        {snippet && <p className="muted mt-0.5 line-clamp-2 text-[13px] leading-[18px]">{snippet}</p>}
      </div>
      <Time date={n.createdAt} />
      <UnreadDot unread={!n.isRead} />
    </button>
  );
}
