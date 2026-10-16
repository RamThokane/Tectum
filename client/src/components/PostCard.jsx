import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, FileType2, Presentation, Download, Lightbulb, Eye, Stethoscope, MessagesSquare, ListChecks, HelpCircle, CircleCheck, Image as ImageIcon } from 'lucide-react';
import Avatar from './Avatar';
import { Chip } from './ui';
import { Tick, RolePill } from './VerificationBadge';
import SensitiveContentOverlay from './SensitiveContentOverlay';
import PostActions from './PostActions';
import PostMenu from './PostMenu';
import { FollowButton, useFollowingIds } from './UserRow';
import { useAuthStore } from '../store/auth';
import FileViewerModal, { canPreviewInApp } from './FileViewerModal';
import { assetUrl } from '../api/client';
import { cldUrl, cldSrcSet } from '../lib/cldUrl';
import { recordDownload } from '../hooks/usePosts';
import { useSeen } from '../hooks/useSeen';
import CaseCard from './CaseCard';
import Lightbox from './Lightbox';
import { CollabPill, CollabAction } from './Collab';
import EditPostModal from './EditPostModal';
import { PrivacyReviewBanner } from './PrivacyWarning';
import { timeAgo, fullDate, cn, stripMentions } from '../lib/format';
import { prettyTag, ageSexLabel } from '../lib/constants';
import { specialtyMeta, wardOf } from '../lib/specialties';
import { SpecialtyDot } from './ds/display';
import { stripHighlights } from './Highlight';

/** Headline shown on cards: explicit title, else the case's chief complaint, else the notes file name. */
export const postTitle = (post) =>
  post.title ||
  (post.type === 'case_study' && post.caseStudy?.chiefComplaint) ||
  (post.type === 'notes' && post.notesFile?.fileName?.replace(/\.[^.]+$/, '')) ||
  '';

/** Uppercase category label: first tag, else the post type. */
export const postCategory = (post) =>
  post.tags?.[0] ? prettyTag(post.tags[0]) : post.type === 'case_study' ? 'Case study' : post.type === 'notes' ? 'Notes' : 'Discussion';

// Web links: http(s)://…, www.… or a bare address with a common ending (tectum.co.in, who.int/news),
// minus trailing punctuation like the full stop ending a sentence. Not part of an email address.
const TLDS = 'com|org|net|in|co|io|edu|gov|int|ai|app|dev|me|info|health|uk|us|ca|au|nz|ae|sg|pk|bd|lk|np|eu|de|fr';
const URL_SRC = String.raw`(?:(?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?'")\]]|(?<![\w@.\/-])(?:[a-z\d][a-z\d-]*\.)+(?:${TLDS})\b(?![@.\w-]*@)(?:\/(?:[^\s<]*[^\s<.,;:!?'")\]])?)?)`;
const RICH_SPLIT = new RegExp(String.raw`(${URL_SRC}|@\[[^\]\n]{1,80}\]\([a-f\d]{24}\)|#[\w-]{2,30})`, 'gi');
const MENTION_ONE = /^@\[([^\]\n]{1,80})\]\(([a-f\d]{24})\)$/i;
const URL_ONE = new RegExp(`^${URL_SRC}$`, 'i');
const URL_SPLIT = new RegExp(`(${URL_SRC})`, 'gi');

/** A link someone typed, opened in a new tab. Only http(s) addresses ever become links. */
export function ExternalLink({ url, className = 'text-link hover:underline' }) {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className={cn('[overflow-wrap:anywhere]', className)} onClick={(e) => e.stopPropagation()}>
      {url}
    </a>
  );
}

/** Plain text with only its web links made clickable (chat messages). */
export function LinkifiedText({ text, linkClassName }) {
  if (!text) return text;
  return text.split(URL_SPLIT).map((p, i) => (URL_ONE.test(p) ? <ExternalLink key={i} url={p} className={linkClassName} /> : p));
}

/**
 * Long text cut to `lines` lines with a "Read more" link that opens it in place (and "Show less"
 * to fold it again). The link only appears when the text really is cut off.
 */
export function ReadMore({ lines = 6, className, children }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return undefined;
    const check = () => setCut(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);
  return (
    <div className={className}>
      <div ref={ref} style={open ? undefined : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden' }}>
        {children}
      </div>
      {(cut || open) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="mt-0.5 text-[15px] font-medium text-link hover:underline"
        >
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

/** Renders text with web links, @mentions linked to profiles and #hashtags linked to Discovery search. */
export function RichText({ text, className, clamp, as: Tag = 'p' }) {
  if (!text) return null;
  if (clamp) {
    return (
      <ReadMore className={className}>
        <RichText text={text} className="" as={Tag} />
      </ReadMore>
    );
  }
  const parts = text.split(RICH_SPLIT);
  return (
    <Tag className={cn('whitespace-pre-wrap break-words leading-relaxed', className)}>
      {parts.map((p, i) => {
        if (URL_ONE.test(p)) return <ExternalLink key={i} url={p} />;
        const m = MENTION_ONE.exec(p);
        if (m) {
          return (
            <Link key={i} to={`/profile/${m[2]}`} className="text-link hover:underline">
              @{m[1]}
            </Link>
          );
        }
        if (/^#[\w-]{2,30}$/.test(p)) {
          return (
            <Link key={i} to={`/discover?q=${encodeURIComponent(p)}`} className="text-link hover:underline">
              {p}
            </Link>
          );
        }
        return p;
      })}
    </Tag>
  );
}

export function Hashtags({ tags, className }) {
  if (!tags?.length) return null;
  return (
    <p className={cn('flex flex-wrap gap-x-3 gap-y-1 text-[13px]', className)}>
      {tags.map((t) => (
        <Link key={t} to={`/discover?q=${encodeURIComponent('#' + t)}`} className="text-link hover:underline">
          #{t.replace(/-(\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase())}
        </Link>
      ))}
    </p>
  );
}

/**
 * Post / case images, sized like X/Twitter; tapping one opens the zoomable Lightbox.
 *  - one image: its own shape, at most 20rem (320px) tall; narrow portraits don't stretch across
 *  - 2-4 images: one 16:9 box (side by side / one big + two small / 2x2), also at most 20rem tall
 */
export function ImageGrid({ images, sensitive, className }) {
  const [open, setOpen] = useState(null);
  if (!images?.length) return null;
  const n = Math.min(images.length, 4);
  const shown = images.slice(0, 4);
  const openAt = (i) => (e) => {
    e.stopPropagation();
    setOpen(i);
  };

  if (n === 1) {
    // Centred at its own shape; the rest of the width is filled with a soft blurred copy,
    // so the post area is covered without cropping the photo.
    return (
      <>
        <SensitiveContentOverlay sensitive={sensitive} className={cn('overflow-hidden rounded-[12px] border border-line', className)}>
          <button type="button" onClick={openAt(0)} className="relative flex w-full cursor-zoom-in justify-center overflow-hidden bg-surface-2" aria-label="Open image">
            <img src={cldUrl(shown[0], { w: 64, crop: 'limit', dpr: 1 })} alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
            <img src={cldUrl(shown[0], { w: 800, crop: 'limit', dpr: 1 })} srcSet={cldSrcSet(shown[0])} sizes="(min-width: 640px) 560px, 100vw" alt="" loading="lazy" decoding="async" className="relative block max-h-80 w-auto max-w-full object-contain" />
          </button>
        </SensitiveContentOverlay>
        {open !== null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} />}
      </>
    );
  }

  return (
    <>
      <SensitiveContentOverlay sensitive={sensitive} className={cn('overflow-hidden rounded-[12px] border border-line', className)}>
        <div className={cn('grid aspect-[16/9] max-h-80 w-full grid-cols-2 gap-0.5', n > 2 && 'grid-rows-2')}>
          {shown.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={openAt(i)}
              className={cn('relative block min-h-0 cursor-zoom-in overflow-hidden bg-surface-2', n === 3 && i === 0 && 'row-span-2')}
              aria-label={`Open image ${i + 1} of ${images.length}`}
            >
              <img src={cldUrl(src, { w: 400, crop: 'limit', dpr: 1 })} srcSet={cldSrcSet(src)} sizes="(min-width: 640px) 280px, 50vw" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </SensitiveContentOverlay>
      {open !== null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Post-type badges: quiet neutral labels; only cases get the soft blue. */
export const POST_BADGES = {
  case: { label: 'Case', icon: Stethoscope, cls: 'bg-ds-brand-soft text-ds-brand-text' },
  pearl: { label: 'Pearl', icon: Lightbulb, cls: 'bg-ds-surface-2 text-ds-fg-2' },
  question: { label: 'Question', icon: HelpCircle, cls: 'bg-ds-surface-2 text-ds-fg-2' },
  image: { label: 'Image', icon: ImageIcon, cls: 'bg-ds-surface-2 text-ds-fg-2' },
  notes: { label: 'Notes', icon: FileText, cls: 'bg-ds-surface-2 text-ds-fg-2' },
  discussion: { label: 'Discussion', icon: MessagesSquare, cls: 'bg-ds-surface-2 text-ds-fg-2' },
};

/** Which badge a post gets: its type, or for quick posts its kind (pearl / question), or "Image" if it's mainly a picture. */
export function badgeKeyFor(post) {
  if (post?.type === 'case_study') return 'case';
  if (post?.type === 'notes' || post?.kind === 'notes') return 'notes'; // old file uploads, or written notes
  if (post?.kind === 'pearl' || post?.kind === 'question') return post.kind;
  if (post?.images?.length) return 'image';
  return 'discussion';
}

/** Post type as a small coloured badge with an icon. Pass the post (or a `badge` key). */
export function TypeBadge({ post, badge, className }) {
  const b = POST_BADGES[badge ?? badgeKeyFor(post)] ?? POST_BADGES.discussion;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[12px] font-medium leading-4', b.cls, className)}>
      <b.icon className="h-3.5 w-3.5" strokeWidth={1.75} /> {b.label}
    </span>
  );
}

/** Specialty tag (Cardiology, Emergency Medicine…) as a pill in that specialty's colour; Ward tags link to the Ward. */
export function SpecialtyPill({ tag, className, link = true }) {
  if (!tag) return null;
  const m = specialtyMeta(tag);
  // outline pill; the specialty's colour only as a small dot
  const cls = cn('inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2 py-0.5 text-[12px] font-medium leading-4 capitalize text-ds-fg-2', className);
  if (!m.isWard || !link) {
    return <span className={cls}><SpecialtyDot hue={m.hue} /> {m.short}</span>;
  }
  return (
    <Link to={`/ward/${m.slug}`} className={cn(cls, 'transition-colors hover:border-ds-fg-4 hover:text-ink')} onClick={(e) => e.stopPropagation()}>
      <SpecialtyDot hue={m.hue} /> {m.short}
    </Link>
  );
}

export function CategoryChip({ children, className }) {
  return <span className={cn('text-[13px] font-medium text-ds-fg-3', className)}>{children}</span>;
}

/** "MCQ Tips" card: one tip per line, rendered as a checklist. */
export function McqTips({ text }) {
  const tips = (text || '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  if (!tips.length) return null;
  return (
    <div className="rounded-[12px] border border-line bg-surface-2/50 p-3.5">
      <p className="ds-eyebrow flex items-center gap-1.5">
        <ListChecks className="h-4 w-4" strokeWidth={1.5} /> MCQ Tips
      </p>
      <ul className="mt-1.5 space-y-1">
        {tips.map((t, i) => (
          <li key={i} className="flex gap-2 text-[15px] leading-[23px]">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ds-brand-text" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Diagnosis hidden behind a "think first" reveal, then MCQ tips and the learning point. */
export function DiagnosisReveal({ caseStudy, initiallyShown = false }) {
  const [shown, setShown] = useState(initiallyShown);
  if (!caseStudy?.diagnosis) return null;
  return (
    <div className="space-y-3">
      <div className="rounded-[12px] border border-line bg-surface-2/50 p-3.5">
        <p className="ds-eyebrow">Diagnosis</p>
        {shown ? (
          <p className="mt-1 font-editorial text-[20px] font-medium leading-[26px]">{caseStudy.diagnosis}</p>
        ) : (
          <button type="button" onClick={() => setShown(true)} className="mt-1 inline-flex items-center gap-1.5 text-[15px] font-medium text-link hover:underline">
            <Eye className="h-4 w-4" strokeWidth={1.5} /> Think first, then reveal diagnosis
          </button>
        )}
      </div>
      {shown && <McqTips text={caseStudy.mcqTips} />}
      {shown && caseStudy.learningPoint && (
        <div className="flex gap-2.5 rounded-[12px] bg-warning-soft p-3.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} />
          <div>
            <p className="ds-eyebrow text-warning!">Learning point</p>
            <p className="mt-0.5 text-[15px] leading-[23px]">{caseStudy.learningPoint}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- notes ----------------
const FILE_META = {
  pdf: { icon: FileText, color: 'text-danger bg-danger-soft' },
  doc: { icon: FileType2, color: 'text-info bg-info-soft' },
  docx: { icon: FileType2, color: 'text-info bg-info-soft' },
  ppt: { icon: Presentation, color: 'text-warning bg-warning-soft' },
  pptx: { icon: Presentation, color: 'text-warning bg-warning-soft' },
};
export const fileMeta = (type) => FILE_META[type] || { icon: FileText, color: 'text-ds-fg-3 bg-surface-2' };

export function NotesFileCard({ file, postId, className }) {
  const [viewing, setViewing] = useState(false);
  if (!file) return null;
  const { icon: Icon, color } = fileMeta(file.fileType);
  const readable = canPreviewInApp(file.fileType);
  return (
    <div className={cn('flex items-center gap-3 rounded-[12px] border border-line p-3', className)}>
      <div className={cn('rounded-[6px] p-2.5', color)}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{file.fileName}</p>
        <p className="muted text-[12px]">{file.fileType?.toUpperCase()} · Study notes</p>
      </div>
      {readable ? (
        <>
          <button type="button" className="btn-secondary px-3 py-1.5 text-[12px]" onClick={() => { setViewing(true); recordDownload(postId); }}>
            <Eye className="h-4 w-4" /> Open
          </button>
          <FileViewerModal file={file} open={viewing} onClose={() => setViewing(false)} />
        </>
      ) : (
        <a href={assetUrl(file.url)} target="_blank" rel="noreferrer" download={file.fileName} onClick={() => recordDownload(postId)} className="btn-secondary px-3 py-1.5 text-[12px]">
          <Download className="h-4 w-4" /> Download
        </a>
      )}
    </div>
  );
}

export function AuthorLine({ user, date, size = 'sm' }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link to={`/profile/${user?._id}`} className="shrink-0" aria-label={`${user?.name ?? "Deleted user"}'s profile`}>
        <Avatar user={user} size={size} />
      </Link>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Link to={`/profile/${user?._id}`} className="truncate hover:underline">{user?.name ?? 'Deleted user'}</Link>
          <Tick user={user} />
          <RolePill user={user} />
        </p>
        <p className="muted truncate text-[12px]">
          {user?.institution}
          {user?.institution && date && ' · '}
          {date && <time dateTime={date} title={fullDate(date)}>{timeAgo(date)}</time>}
        </p>
      </div>
    </div>
  );
}

/**
 * The quoted post inside a quote post (X-style bordered box). `quote` is the populated
 * original, or null/an id string if it has been deleted. Clicking opens the original.
 */
export function QuotedPost({ quote, className, link = true }) {
  const navigate = useNavigate();
  if (!quote || typeof quote === 'string') {
    return (
      <div className={cn('muted rounded-[12px] border border-line bg-surface-2/50 px-4 py-3 text-[15px]', className)}>
        This post is unavailable.
      </div>
    );
  }
  const title = postTitle(quote);
  const text = quote.type === 'case_study' && !quote.title ? '' : stripMentions(quote.content || '');
  const thumb = quote.images?.[0];
  const open = (e) => {
    if (!link) return;
    e.stopPropagation();
    navigate(`/post/${quote._id}`);
  };
  return (
    <div
      role={link ? 'link' : undefined}
      tabIndex={link ? 0 : undefined}
      onClick={open}
      onKeyDown={(e) => link && e.key === 'Enter' && open(e)}
      className={cn(
        'overflow-hidden rounded-[12px] border border-line text-left',
        link && 'cursor-pointer transition hover:bg-surface-2/60',
        className
      )}
    >
      <div className="px-3 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[15px] leading-5">
          <Avatar user={quote.author} size="xs" className="!h-5 !w-5 text-[12px]" />
          <span className="truncate font-semibold">{quote.author?.name ?? 'Deleted user'}</span>
          <Tick user={quote.author} />
          <span className="muted shrink-0">· {timeAgo(quote.createdAt)}</span>
        </div>
        {quote.type !== 'text' && <TypeBadge type={quote.type} className="mt-1" />}
        {title && <p className="mt-0.5 font-editorial text-[17px] font-medium leading-snug">{title}</p>}
        {text && <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-[15px] leading-5">{text}</p>}
        {quote.type === 'notes' && quote.notesFile?.fileName && (
          <p className="muted mt-1 flex items-center gap-1 text-[13px]"><FileText className="h-3.5 w-3.5" /> {quote.notesFile.fileName}</p>
        )}
      </div>
      {thumb ? (
        <SensitiveContentOverlay sensitive={quote.isSensitiveContent} className="mt-2.5">
          <img src={cldUrl(thumb, { w: 600, crop: 'limit', dpr: 1 })} srcSet={cldSrcSet(thumb)} sizes="(min-width: 640px) 520px, 100vw" alt="" loading="lazy" className="max-h-72 w-full object-cover" />
        </SensitiveContentOverlay>
      ) : (
        <div className="h-2.5" />
      )}
    </div>
  );
}

/**
 * A quoted comment inside a quote post: author, "Replying to …" and the comment text.
 * Clicking opens the post it was written on, scrolled to that comment.
 */
export function QuotedComment({ comment, className, link = true }) {
  const navigate = useNavigate();
  if (!comment || typeof comment === 'string') {
    return (
      <div className={cn('muted rounded-[12px] border border-line bg-surface-2/50 px-4 py-3 text-[15px]', className)}>
        This comment is unavailable.
      </div>
    );
  }
  const post = typeof comment.post === 'object' ? comment.post : null;
  const postId = post?._id ?? comment.post;
  const open = (e) => {
    if (!link) return;
    e.stopPropagation();
    navigate(`/post/${postId}#comment-${comment._id}`);
  };
  return (
    <div
      role={link ? 'link' : undefined}
      tabIndex={link ? 0 : undefined}
      onClick={open}
      onKeyDown={(e) => link && e.key === 'Enter' && open(e)}
      className={cn(
        'rounded-[12px] border border-line px-3 py-2.5 text-left',
        link && 'cursor-pointer transition hover:bg-surface-2/60',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[15px] leading-5">
        <Avatar user={comment.author} size="xs" className="!h-5 !w-5 text-[12px]" />
        <span className="truncate font-semibold">{comment.author?.name ?? 'Deleted user'}</span>
        <Tick user={comment.author} />
        <span className="muted shrink-0">· {timeAgo(comment.createdAt)}</span>
      </div>
      {post?.author?.name && (
        <p className="muted mt-0.5 truncate text-[13px]">
          Replying to <span className="text-link">{post.author.name}</span>
          {post.title && <> · {post.title}</>}
        </p>
      )}
      <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-[15px] leading-5">{stripMentions(comment.text || '')}</p>
    </div>
  );
}

/** Whatever a quote post quotes: a post (older quotes have no quoteKind) or a comment. */
export function QuoteEmbed({ post, className }) {
  if (!post?.isQuote) return null;
  return post.quoteKind === 'comment' ? (
    <QuotedComment comment={post.quoteOfComment} className={className} />
  ) : (
    <QuotedPost quote={post.quoteOf} className={className} />
  );
}

/** The author's warning on a post flagged by the privacy check, with an "Edit now" button. */
export function PostPrivacyBanner({ post, className }) {
  const me = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  if (!post.privacyReview?.removeAt || !me || String(post.author?._id) !== String(me._id)) return null;
  return (
    <>
      <PrivacyReviewBanner
        review={post.privacyReview}
        className={className}
        action={
          <button className="rounded-full bg-warning px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-warning" onClick={() => setEditing(true)}>
            Edit now
          </button>
        }
      />
      {editing && <EditPostModal post={post} onClose={() => setEditing(false)} />}
    </>
  );
}

// ---------------- card ----------------
/**
 * One post in a list. Optional: `context` - a small line above it (e.g. "In Cardiology Ward");
 * `showFollow` - a Follow button next to authors you don't follow yet (Home timeline).
 */
export default function PostCard({ post, full = false, onDeleted, context, showFollow = false }) {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const title = postTitle(post);
  const cs = post.caseStudy;
  // For case studies the chief complaint is already the headline when no title was given.
  const summary = post.type === 'case_study' ? post.content || stripHighlights(cs?.history) : post.content;

  const openPost = (e) => {
    if (full) return;
    if (e.target.closest('a,button,input,textarea,[role="dialog"]')) return;
    if (window.getSelection()?.toString()) return;
    navigate(`/post/${post._id}`);
  };

  const seenRef = useSeen('post', post._id);
  const author = post.author;
  const followingIds = useFollowingIds({ enabled: showFollow });
  const canFollow = showFollow && author?._id && me && author._id !== me._id && !followingIds.has(String(author._id));

  // Tectum card: author header, then type + specialty badges, then the content full-width.
  return (
    <article
      ref={seenRef}
      onClick={openPost}
      className={cn('px-4 pb-2 pt-4 transition duration-200 sm:px-5', !full && 'cursor-pointer hover:bg-surface-2/60')}
    >
      {context && <p className="muted mb-2 flex items-center gap-1.5 pl-14 text-[13px] font-medium">{context}</p>}
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/profile/${author?._id}`} className="shrink-0" aria-label={`${author?.name ?? "Deleted user"}'s profile`}>
            <Avatar user={author} size="md" />
          </Link>
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5 text-[15px] leading-5">
              <Link to={`/profile/${author?._id}`} className="truncate font-semibold hover:underline">
                {author?.name ?? 'Deleted user'}
              </Link>
              <Tick user={author} />
              <RolePill user={author} />
            </p>
            <p className="muted truncate text-[13px]">
              {author?.institution && <span className="hidden sm:inline">{author.institution} · </span>}
              <time dateTime={post.createdAt} title={fullDate(post.createdAt)}>{timeAgo(post.createdAt)}</time>
            </p>
          </div>
        </div>
        <div className="-mr-2 flex shrink-0 items-center gap-1">
          {canFollow && <FollowButton userId={author._id} className="min-h-8 px-3 py-1 text-[13px]" />}
          <PostMenu post={post} onDeleted={onDeleted} />
        </div>
      </header>

      <PostPrivacyBanner post={post} className="mt-3" />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TypeBadge post={post} />
        <SpecialtyPill tag={wardOf(post) ?? post.tags?.[0]} />
        <CollabPill post={post} />
        {post.type === 'case_study' && ageSexLabel(cs) && (
          <span className="ds-num rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-[12px] font-medium leading-4 text-ds-fg-2">
            {ageSexLabel(cs)}
          </span>
        )}
        {/* the same "Solved" badge everywhere a case card appears (feed, search, profile, Ward) */}
        {post.type === 'case_study' && post.solved && (
          <Chip tone="success" icon={CircleCheck}>Solved</Chip>
        )}
      </div>

      {post.type === 'case_study' ? (
        <CaseCard post={post} full={full} className="mt-2" />
      ) : (
        <>
          {title && <h3 className="mt-2 font-editorial text-[20px] font-medium leading-[26px] tracking-[-0.01em]">{title}</h3>}
          <RichText text={summary} clamp={!full} className={cn('text-[15px] leading-[23px] text-ink', title ? 'mt-1' : 'mt-2')} />
          {post.type === 'notes' && <NotesFileCard file={post.notesFile} postId={post._id} className="mt-3" />}
          <ImageGrid images={post.images} sensitive={post.isSensitiveContent} className="mt-3" />
        </>
      )}
      <QuoteEmbed post={post} className="mt-3" />
      <Hashtags tags={post.tags} className="mt-2" />

      <CollabAction post={post} className="mt-3" />
      <div className="mt-2 border-t border-line pt-1">
        <PostActions post={post} />
      </div>
    </article>
  );
}
