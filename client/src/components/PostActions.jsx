import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Repeat2, Heart, Bookmark, Share, PenLine, BarChart2 } from 'lucide-react';
import { useTogglePost } from '../hooks/usePosts';
import { compact, cn } from '../lib/format';
import { toast, useUIStore } from '../store/ui';

/**
 * X's repost button: a small menu with "Repost" (or "Undo repost") and "Quote".
 * Used for posts and comments: pass the count/state and what each choice does.
 */
export function RepostMenu({ count, reposted, onRepost, onQuote }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const item = 'flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-left text-[15px] font-medium transition-colors hover:bg-surface-2';
  return (
    <div ref={ref} className="relative">
      <Action
        icon={Repeat2}
        count={count}
        active={reposted}
        label="Repost or quote"
        onClick={() => setOpen((o) => !o)}
        activeClass="text-success"
        hoverClass="hover:text-success"
        aria-haspopup="menu"
        aria-expanded={open}
      />
      {open && (
        <div
          role="menu"
          className="ds-glass-strong ds-rise absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-[12px] p-1.5"
        >
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onRepost();
            }}
          >
            <Repeat2 className="h-[18px] w-[18px]" strokeWidth={1.5} /> {reposted ? 'Undo repost' : 'Repost'}
          </button>
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onQuote();
            }}
          >
            <PenLine className="h-[18px] w-[18px]" strokeWidth={1.5} /> Quote
          </button>
        </div>
      )}
    </div>
  );
}

/** One icon button in a post/comment action row: icon, optional count, hover label. */
export function Action({ icon: Icon, count, active, activeClass, hoverClass, label, onClick, to, fill, ...rest }) {
  const cls = cn(
    'group relative inline-flex items-center gap-1.5 rounded-full py-1.5 pr-2 text-[13px] tabular-nums transition',
    active ? activeClass : cn('text-ds-fg-3', hoverClass)
  );
  const inner = (
    <>
      <span className="rounded-full p-1.5 transition group-hover:bg-current/10 group-active:scale-90">
        <Icon className={cn('h-[18px] w-[18px]', active && fill && 'fill-current')} strokeWidth={1.5} />
      </span>
      {/* hover / keyboard-focus label; group-hover only fires on devices with a real pointer */}
      <span
        aria-hidden="true"
        className="ds-glass-strong pointer-events-none absolute bottom-full left-[15px] z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-[6px] px-2 py-1 text-[12px] font-medium text-ink opacity-0 transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
      {count !== undefined && <span className={cn(!count && 'invisible')}>{compact(count)}</span>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={label}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={label} aria-pressed={active} {...rest}>
      {inner}
    </button>
  );
}

export default function PostActions({ post }) {
  const toggle = useTogglePost();
  const openComposer = useUIStore((s) => s.openComposer);
  const run = (action) => toggle.mutate({ id: post._id, action });

  const share = async () => {
    const url = `${window.location.origin}/post/${post._id}`;
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
    // X's spacing: comment, repost and like spread out; save + share grouped on the right.
    <div className="-ml-1.5 flex items-center justify-between">
      <Action icon={MessageCircle} count={post.commentCount} label="Comment" to={`/post/${post._id}#comments`} hoverClass="hover:text-link" />
      <RepostMenu
        count={(post.repostCount ?? 0) + (post.quoteCount ?? 0)}
        reposted={post.reposted}
        onRepost={() => run('repost')}
        onQuote={() => openComposer('text', { quote: post })}
      />
      <Action
        icon={Heart}
        count={post.likeCount}
        active={post.liked}
        fill
        label={post.liked ? 'Unlike' : 'Like'}
        onClick={() => run('like')}
        activeClass="text-ds-accent-text"
        hoverClass="hover:text-ds-accent-text"
      />
      <Action icon={BarChart2} count={post.views ?? 0} label="Views" hoverClass="hover:text-link" />
      <div className="flex items-center">
        <Action
          icon={Bookmark}
          active={post.bookmarked}
          fill
          label={post.bookmarked ? 'Unsave' : 'Save'}
          onClick={() => run('bookmark')}
          activeClass="text-link"
          hoverClass="hover:text-link"
        />
        <Action icon={Share} label="Share" onClick={share} hoverClass="hover:text-link" />
      </div>
    </div>
  );
}
