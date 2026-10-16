import { useRef, useState } from 'react';
import { MessageCircle, Bookmark, Share, Check, X, CornerDownRight, SendHorizontal, Plus, Lightbulb, Stethoscope, MessageSquareText, Heart, UserPlus, AtSign, Repeat2, BadgeCheck, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/format';
import { Avatar, RoleBadge, SpecialtyDot } from './display';
import { IconButton } from './Button';
import { Dropdown } from './surfaces';

/** Lab values / vitals in mono, so "BP 88/60" and "Trop 2.4" read as data. */
export const Vital = ({ children }) => <span className="font-code text-[0.88em] tracking-tight">{children}</span>;

const DIFFICULTY = { easy: 'Foundation', medium: 'Intermediate', hard: 'Advanced' };

/**
 * The case card (feeds, Ward, Case Rounds): specialty dot + name, serif title, a short
 * presentation, optional image, a meta row and quiet actions. No pastel box: a flat card with a
 * hairline, hierarchy from type alone.
 */
export function CaseCard({ c, onOpen }) {
  const [saved, setSaved] = useState(Boolean(c.saved));
  return (
    <article className="ds-card ds-lift p-5 sm:p-6" aria-labelledby={`case-${c.id}`}>
      <div className="flex items-center gap-2 text-meta">
        <SpecialtyDot hue={c.specialty.hue} />
        <span className="font-medium text-ds-fg-2">{c.specialty.label}</span>
        <span className="text-ds-fg-4" aria-hidden="true">·</span>
        <span className="font-code text-caption text-ds-fg-3">{c.caseId}</span>
        {c.solved && (
          <span className="ml-auto inline-flex items-center gap-1 text-caption font-medium text-ds-success">
            <Check className="size-3.5" strokeWidth={2.25} aria-hidden="true" /> Solved
          </span>
        )}
      </div>

      <h3 id={`case-${c.id}`} className="mt-3 font-editorial text-title font-medium text-ds-fg">
        <button type="button" onClick={onOpen} className="ds-focus rounded-ds-sm text-left hover:underline hover:decoration-ds-line-strong hover:underline-offset-4">
          {c.title}
        </button>
      </h3>
      <p className="mt-2 line-clamp-3 text-body text-ds-fg-2">{c.presentation}</p>

      {c.image && (
        <div className="mt-4 overflow-hidden rounded-ds-md border border-ds-line">
          <img src={c.image} alt={c.imageAlt ?? ''} className="aspect-[16/9] w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ds-fg-3">
        <Avatar user={c.author} size="xs" />
        <span className="font-medium text-ds-fg-2">{c.author.name}</span>
        <RoleBadge role={c.author.role} verified={c.author.verified} />
        <span aria-hidden="true">·</span>
        <time>{c.time}</time>
        {c.difficulty && (
          <>
            <span aria-hidden="true">·</span>
            <span>{DIFFICULTY[c.difficulty]}</span>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-ds-line pt-3">
        <div className="flex items-center gap-4 text-meta text-ds-fg-3">
          <span className="ds-num">{c.votes} votes</span>
          <span className="ds-num">{c.answers} answers</span>
        </div>
        <div className="-mr-2 flex items-center">
          <IconButton icon={MessageCircle} label="Discuss" size="sm" onClick={onOpen} />
          <IconButton icon={Bookmark} label={saved ? 'Remove from Notebook' : 'Save to Notebook'} size="sm" aria-pressed={saved} onClick={() => setSaved((s) => !s)} className={saved ? 'text-ds-brand-text' : undefined} />
          <IconButton icon={Share} label="Share" size="sm" />
        </div>
      </div>
    </article>
  );
}

/**
 * "What's your diagnosis?" Pick a row; after voting every row shows its share, the correct one
 * marked in green (with a check and the word, not colour alone) and a wrong pick in red.
 */
export function Poll({ options, correct, initialVote = null, votes: initialVotes }) {
  const [vote, setVote] = useState(initialVote);
  const counts = initialVotes.map((n, i) => n + (vote === i ? 1 : 0));
  const total = counts.reduce((a, b) => a + b, 0);
  const revealed = vote !== null;
  return (
    <section aria-label="What's your diagnosis?">
      <h4 className="font-editorial text-lead font-medium text-ds-fg">What's your diagnosis?</h4>
      <div className="mt-3 space-y-2" role={revealed ? undefined : 'radiogroup'} aria-label="Answers">
        {options.map((o, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
          const isCorrect = i === correct;
          const mine = vote === i;
          if (!revealed) {
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={false}
                onClick={() => setVote(i)}
                className="ds-press ds-focus flex h-12 w-full items-center gap-3 rounded-ds-md border border-ds-line-strong bg-ds-surface px-4 text-left text-body text-ds-fg hover:border-ds-brand-text hover:bg-ds-brand-soft"
              >
                <span className="font-code text-meta text-ds-fg-3">{String.fromCharCode(65 + i)}</span>
                {o}
              </button>
            );
          }
          return (
            <div key={o} className={cn('relative flex h-12 items-center gap-3 overflow-hidden rounded-ds-md border px-4 text-body', isCorrect ? 'border-ds-success' : mine ? 'border-ds-danger' : 'border-ds-line')}>
              <span
                className={cn('absolute inset-y-0 left-0 transition-[width] duration-500 ease-out', isCorrect ? 'bg-ds-success-soft' : mine ? 'bg-ds-danger-soft' : 'bg-ds-surface-2')}
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
              <span className="relative font-code text-meta text-ds-fg-3">{String.fromCharCode(65 + i)}</span>
              <span className={cn('relative flex-1', isCorrect && 'font-medium')}>{o}</span>
              {isCorrect && (
                <span className="relative inline-flex items-center gap-1 text-caption font-semibold text-ds-success">
                  <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" /> Correct
                </span>
              )}
              {mine && !isCorrect && (
                <span className="relative inline-flex items-center gap-1 text-caption font-semibold text-ds-danger">
                  <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" /> Your answer
                </span>
              )}
              <span className="ds-num relative w-10 text-right text-meta font-medium text-ds-fg-2">{pct}%</span>
            </div>
          );
        })}
      </div>
      {revealed && (
        <p className="mt-3 text-meta text-ds-fg-3">
          <span className="ds-num">{total}</span> votes · {vote === correct ? <span className="font-medium text-ds-success">You got it right.</span> : 'Read the explanation below.'}
        </p>
      )}
    </section>
  );
}

/** One comment; `replies` are drawn indented under a thread line. */
function Comment({ c, depth = 0, onReply }) {
  return (
    <li className="relative">
      <div className="flex gap-3">
        <Avatar user={c.author} size={depth ? 'xs' : 'sm'} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-meta">
            <span className="font-medium text-ds-fg">{c.author.name}</span>
            <RoleBadge role={c.author.role} verified={c.author.verified} />
            <span className="text-ds-fg-3">{c.time}</span>
          </p>
          <p className="mt-1 text-body text-ds-fg-2">{c.text}</p>
          <div className="mt-1.5 flex items-center gap-4 text-meta text-ds-fg-3">
            <button type="button" className="ds-focus inline-flex items-center gap-1 rounded-ds-sm hover:text-ds-accent-text">
              <Heart className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> <span className="ds-num">{c.likes}</span>
              <span className="sr-only">likes</span>
            </button>
            <button type="button" onClick={() => onReply(c)} className="ds-focus rounded-ds-sm font-medium hover:text-ds-fg">
              Reply
            </button>
          </div>
        </div>
      </div>
      {c.replies?.length > 0 && (
        // the thread line runs down from the parent's avatar
        <ul className="mt-4 space-y-4 border-l border-ds-line pl-5 sm:ml-4">
          {c.replies.map((r) => (
            <Comment key={r.id} c={r} depth={depth + 1} onReply={onReply} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Discussion under a case: nested replies and a reply box at the end. */
export function CommentThread({ comments, me }) {
  const [replyTo, setReplyTo] = useState(null);
  const [text, setText] = useState('');
  const box = useRef(null);
  const reply = (c) => {
    setReplyTo(c);
    box.current?.focus();
  };
  return (
    <section aria-label="Discussion">
      <ul className="space-y-6">
        {comments.map((c) => (
          <Comment key={c.id} c={c} onReply={reply} />
        ))}
      </ul>
      <form className="mt-6 flex items-start gap-3 border-t border-ds-line pt-5" onSubmit={(e) => e.preventDefault()}>
        <Avatar user={me} size="sm" />
        <div className="min-w-0 flex-1">
          {replyTo && (
            <p className="mb-1.5 flex items-center gap-1.5 text-meta text-ds-fg-3">
              <CornerDownRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Replying to <span className="font-medium text-ds-fg-2">{replyTo.author.name}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="ds-focus ml-1 rounded-full p-0.5 hover:bg-ds-surface-2" aria-label="Cancel reply">
                <X className="size-3" strokeWidth={2} />
              </button>
            </p>
          )}
          <label htmlFor="ds-reply" className="sr-only">Write a reply</label>
          <textarea
            id="ds-reply"
            ref={box}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add to the discussion. No patient identifiers."
            className="w-full resize-none rounded-ds-sm border border-ds-line-strong bg-ds-surface px-3 py-2.5 text-body text-ds-fg outline-none placeholder:text-ds-fg-4 focus:border-ds-brand-text focus:shadow-[0_0_0_3px_var(--ds-focus)]"
          />
          <div className="mt-2 flex justify-end">
            <button type="submit" disabled={!text.trim()} className="ds-press ds-focus h-8 rounded-full bg-ds-brand px-4 text-meta font-medium text-ds-on-brand disabled:opacity-45">
              Reply
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

/** Chat: sent bubbles in blue on the right, received in neutral on the left; a glass composer bar. */
export function ChatView({ messages }) {
  const [text, setText] = useState('');
  return (
    <div className="flex h-96 flex-col overflow-hidden rounded-ds-lg border border-ds-line bg-ds-bg">
      <ol className="flex-1 space-y-1.5 overflow-y-auto p-4" aria-label="Messages">
        {messages.map((m) => (
          <li key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[78%] rounded-ds-lg px-3.5 py-2 text-body',
                m.mine ? 'rounded-br-ds-sm bg-ds-brand text-ds-on-brand' : 'rounded-bl-ds-sm bg-ds-bubble-in text-ds-fg'
              )}
            >
              {m.text}
              <span className={cn('ds-num ml-2 align-bottom text-caption', m.mine ? 'text-white/75' : 'text-ds-fg-3')}>{m.time}</span>
            </div>
          </li>
        ))}
      </ol>
      <form className="ds-glass m-2 flex items-center gap-2 rounded-full p-1.5 pl-4" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="ds-chat" className="sr-only">Message</label>
        <input id="ds-chat" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" className="h-9 min-w-0 flex-1 bg-transparent text-body text-ds-fg outline-none placeholder:text-ds-fg-4" />
        <IconButton icon={ImageIcon} label="Attach image" size="sm" />
        <button type="submit" disabled={!text.trim()} className="ds-press ds-focus flex size-9 items-center justify-center rounded-full bg-ds-brand text-ds-on-brand disabled:opacity-45" aria-label="Send">
          <SendHorizontal className="size-4" strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}

const NOTIF_ICON = { like: Heart, reply: MessageCircle, follow: UserPlus, mention: AtSign, repost: Repeat2, verified: BadgeCheck };

/** One notification: icon by type, who / what, time, a coral dot while unread. */
export function NotificationRow({ n }) {
  const Icon = NOTIF_ICON[n.type] ?? MessageCircle;
  return (
    <li>
      <a href="#" onClick={(e) => e.preventDefault()} className={cn('ds-focus flex items-start gap-3 rounded-ds-md px-3 py-3 hover:bg-ds-surface-2', n.unread && 'bg-ds-brand-soft/40')}>
        <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-ds-surface-2 text-ds-fg-2">
          <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-body text-ds-fg-2">
          <span className="font-medium text-ds-fg">{n.who}</span> {n.what}
          {n.excerpt && <span className="mt-0.5 block truncate text-meta text-ds-fg-3">{n.excerpt}</span>}
        </span>
        <span className="ds-num shrink-0 pt-0.5 text-meta text-ds-fg-3">{n.time}</span>
        {n.unread && (
          <span className="mt-2 size-2 shrink-0 rounded-full bg-ds-accent" role="img" aria-label="Unread" />
        )}
      </a>
    </li>
  );
}

/** Notifications grouped under Today / Earlier headings. */
export function NotificationList({ groups }) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h3 className="ds-eyebrow px-3 pb-1.5">{g.label}</h3>
          <ul>{g.items.map((n) => <NotificationRow key={n.id} n={n} />)}</ul>
        </section>
      ))}
    </div>
  );
}

/** Notebook page: a quiet document surface, serif headings, generous line height. */
export function NotebookSurface({ title, meta, children }) {
  return (
    <article className="ds-card mx-auto max-w-2xl px-6 py-8 sm:px-12 sm:py-12">
      <p className="ds-eyebrow">{meta}</p>
      <h2 className="mt-3 font-editorial text-headline font-medium text-ds-fg">{title}</h2>
      <div className="mt-6 space-y-4 text-lead text-ds-fg-2 [&_h3]:mt-8 [&_h3]:font-editorial [&_h3]:text-title [&_h3]:font-medium [&_h3]:text-ds-fg [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-medium [&_strong]:text-ds-fg">
        {children}
      </div>
    </article>
  );
}

/** The floating "+" (glass) that opens what to create. */
export function ComposeButton({ onPick }) {
  return (
    <Dropdown
      label="Create"
      trigger={
        <button type="button" className="ds-glass-strong ds-press ds-focus flex size-14 items-center justify-center rounded-full text-ds-brand-text" aria-label="Create">
          <Plus className="size-6" strokeWidth={1.75} />
        </button>
      }
      items={[
        { label: 'Pearl', icon: Lightbulb, onSelect: () => onPick?.('pearl') },
        { label: 'Case', icon: Stethoscope, onSelect: () => onPick?.('case') },
        { label: 'Discussion', icon: MessageSquareText, onSelect: () => onPick?.('discussion') },
      ]}
    />
  );
}

