import { useEffect, useRef, useState } from 'react';
import { Globe, UserCheck, Users, AtSign, BadgeCheck, Check } from 'lucide-react';
import { cn } from '../lib/format';

/** X's "Who can reply?" choices. `short` is the button label, `note` is shown on the post. */
export const REPLY_OPTIONS = [
  { id: 'everyone', label: 'Everyone', short: 'Everyone can reply', icon: Globe },
  { id: 'following', label: 'Accounts you follow', short: 'Accounts you follow can reply', note: 'follows can reply', icon: UserCheck },
  { id: 'network', label: 'Accounts you follow and who they follow', short: 'Your network can reply', note: 'follows, and who they follow, can reply', icon: Users },
  { id: 'mentioned', label: 'Only accounts you mention', short: 'Only people you mention can reply', note: 'mentioned can reply', icon: AtSign },
  { id: 'verified', label: 'Verified accounts', short: 'Verified accounts can reply', icon: BadgeCheck },
];

/** "Everyone can reply" button that opens the chooser above it. */
export function ReplyPolicyPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = REPLY_OPTIONS.find((o) => o.id === value) ?? REPLY_OPTIONS[0];

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="-ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-link transition hover:bg-link/10"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <current.icon className="h-4 w-4" /> {current.short}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Who can reply?"
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(22rem,calc(100vw-2rem))] rounded-[12px] border border-line bg-surface py-3"
        >
          <p className="px-4 pb-2 text-[15px] font-semibold">Who can reply?</p>
          {REPLY_OPTIONS.map((o) => {
            const selected = o.id === current.id;
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] font-semibold transition hover:bg-surface-2"
              >
                <o.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{o.label}</span>
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-link bg-primary text-on-primary' : 'border-line-strong'
                  )}
                >
                  {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One-line note on a post that limits replies, e.g. "People Dr. Priya follows can reply". */
export function replyNote(post) {
  const o = REPLY_OPTIONS.find((x) => x.id === post?.replyPolicy);
  if (!o || o.id === 'everyone') return null;
  if (o.id === 'verified') return 'Only verified accounts can reply';
  const name = post.author?.name ?? 'the author';
  return `People ${name} ${o.note}`;
}
