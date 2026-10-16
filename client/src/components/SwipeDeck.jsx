import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Bookmark, Layers, RotateCcw, Check, Undo2, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { cldUrl } from '../lib/cldUrl';
import { useTogglePost } from '../hooks/usePosts';
import { Modal, Spinner } from './ui';
import Avatar from './Avatar';
import { RolePill } from './VerificationBadge';
import SensitiveContentOverlay from './SensitiveContentOverlay';
import { TypeBadge, SpecialtyPill, postTitle } from './PostCard';
import { wardOf } from '../lib/specialties';
import { ageSexLabel } from '../lib/constants';
import { cn, stripMentions, pluralize } from '../lib/format';
import { useGradeCard } from '../hooks/useReviews';
import { isTouchDevice } from '../lib/device';

const THRESHOLD = 90; // px of drag that counts as a swipe

/**
 * A stack of cards you swipe: drag (or flick) right / left, press the arrow keys, or tap the
 * buttons. `onSwipe(item, 'right' | 'left')` runs after the card flies off.
 */
export function SwipeDeck({ items, renderCard, onSwipe, leftLabel, rightLabel, leftIcon: LeftIcon = X, rightIcon: RightIcon = Check, onTap, hideButtons = false }) {
  const [drag, setDrag] = useState({ x: 0, active: false });
  const [leaving, setLeaving] = useState(null); // 'left' | 'right' while the top card flies off
  const start = useRef(null);
  const top = items[0];

  const fling = useCallback(
    (dir) => {
      if (!top || leaving) return;
      setLeaving(dir);
      setTimeout(() => {
        onSwipe(top, dir);
        setLeaving(null);
        setDrag({ x: 0, active: false });
      }, 220);
    },
    [top, leaving, onSwipe]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') fling('right');
      if (e.key === 'ArrowLeft') fling('left');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fling]);

  const onPointerDown = (e) => {
    if (leaving) return;
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // keep tracking the drag outside the card
    } catch {
      /* not a real pointer (e.g. synthetic event) */
    }
    setDrag({ x: 0, active: true });
  };
  const onPointerMove = (e) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    if (Math.abs(dx) > 6) start.current.moved = true;
    setDrag({ x: dx, active: true });
  };
  const onPointerUp = () => {
    if (!start.current) return;
    const { moved } = start.current;
    start.current = null;
    if (drag.x > THRESHOLD) fling('right');
    else if (drag.x < -THRESHOLD) fling('left');
    else {
      setDrag({ x: 0, active: false });
      if (!moved) onTap?.(top);
    }
  };

  const x = leaving === 'right' ? 600 : leaving === 'left' ? -600 : drag.x;
  const hint = x > 30 ? 'right' : x < -30 ? 'left' : null;

  return (
    <div className="select-none">
      <div className="relative mx-auto h-[420px] w-full max-w-sm">
        {items.slice(0, 3).reverse().map((item, i, arr) => {
          const depth = arr.length - 1 - i; // 0 = top card
          const isTop = depth === 0;
          return (
            <div
              key={item.key}
              className={cn('absolute inset-0 touch-none', isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none')}
              style={{
                transform: isTop ? `translateX(${x}px) rotate(${x / 18}deg)` : `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`,
                transition: isTop && drag.active && !leaving ? 'none' : 'transform 220ms ease',
                zIndex: 10 - depth,
              }}
              {...(isTop ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } : {})}
            >
              <div className="card relative h-full overflow-hidden">
                {renderCard(item)}
                {isTop && hint && (
                  <span
                    className={cn(
                      'absolute top-4 rounded-[12px] border-2 px-3 py-1 text-[13px] font-semibold uppercase',
                      hint === 'right' ? 'left-4 -rotate-12 border-success/40 text-success' : 'right-4 rotate-12 border-line-strong text-ds-fg-3'
                    )}
                  >
                    {hint === 'right' ? rightLabel : leftLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!hideButtons && (<>
      <div className="mt-6 flex items-center justify-center gap-6">
        <button onClick={() => fling('left')} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-line-strong bg-surface text-ds-fg-3 transition hover:scale-105" aria-label={leftLabel} title={`${leftLabel} (←)`}>
          <LeftIcon className="h-6 w-6" />
        </button>
        <button onClick={() => fling('right')} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary transition hover:scale-105" aria-label={rightLabel} title={`${rightLabel} (→)`}>
          <RightIcon className="h-6 w-6" />
        </button>
      </div>
      <p className="muted mt-3 text-center text-[12px]">
        {isTouchDevice()
          ? <>Swipe right for &ldquo;{rightLabel}&rdquo;, left for &ldquo;{leftLabel}&rdquo;.</>
          : <>Press → for &ldquo;{rightLabel}&rdquo;, ← for &ldquo;{leftLabel}&rdquo;, or use the buttons.</>}
      </p>
      </>)}
    </div>
  );
}

function DeckDone({ icon: Icon = Sparkles, title, children, onClose, onRestart }) {
  return (
    <div className="flex h-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-[12px] bg-ds-brand-soft text-link"><Icon className="h-7 w-7" /></span>
      <p className="text-[17px] font-semibold">{title}</p>
      <p className="muted text-[13px]">{children}</p>
      <div className="mt-2 flex gap-2">
        {onRestart && <button className="btn-secondary" onClick={onRestart}><RotateCcw className="h-4 w-4" /> Go again</button>}
        <button className="btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pearls

function PearlCardFace({ post }) {
  const img = post.images?.[0];
  const text = postTitle(post) || stripMentions(post.content || '');
  return (
    <div className="flex h-full flex-col">
      {img && (
        <SensitiveContentOverlay sensitive={post.isSensitiveContent} className="shrink-0">
          <img src={cldUrl(img, { w: 420, h: 176, gravity: 'auto' })} alt="" draggable={false} className="h-44 w-full bg-surface-2 object-cover" />
        </SensitiveContentOverlay>
      )}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge post={post} />
          <SpecialtyPill tag={wardOf(post) ?? post.tags?.[0]} link={false} />
        </div>
        <p className={cn('mt-3 min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-words leading-snug', img ? 'text-[15px] line-clamp-6' : 'text-[17px] font-semibold line-clamp-[12]')}>{text}</p>
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <Avatar user={post.author} size="xs" />
          <span className="truncate text-[13px] font-semibold">{post.author?.name}</span>
          <RolePill user={post.author} />
        </div>
      </div>
    </div>
  );
}

const swipePearlsQuery = (params) => ({
  queryKey: ['posts', 'swipe-pearls', params],
  queryFn: () => api.get('/posts', { params: { ...params, grid: true, limit: 30 } }).then((r) => r.data.posts),
});

/** Swipe through pearls: right saves to your Notebook, left skips. */
export function PearlSwipeModal({ params = {}, onClose }) {
  const toggle = useTogglePost();
  const { data, isPending } = useQuery({ ...swipePearlsQuery(params), staleTime: 0 });
  const [queue, setQueue] = useState(null);
  const [saved, setSaved] = useState(0);
  useEffect(() => {
    // Only pearls you haven't saved yet.
    if (data && queue === null) setQueue(data.filter((p) => !p.bookmarked).map((p) => ({ key: p._id, post: p })));
  }, [data, queue]);

  const onSwipe = (item, dir) => {
    if (dir === 'right') {
      toggle.mutate({ id: item.post._id, action: 'bookmark' });
      setSaved((n) => n + 1);
    }
    setQueue((q) => q.slice(1));
  };

  return (
    <Modal open onClose={onClose} title="Swipe pearls" size="max-w-md">
      <div className="p-5">
        {isPending || queue === null ? (
          <div className="flex h-[420px] items-center justify-center"><Spinner /></div>
        ) : queue.length ? (
          <>
            <p className="muted mb-3 text-center text-[13px]">{pluralize(queue.length, 'pearl')} left · {saved} saved</p>
            <SwipeDeck
              items={queue}
              renderCard={(item) => <PearlCardFace post={item.post} />}
              onSwipe={onSwipe}
              leftLabel="Skip"
              rightLabel="Save"
              rightIcon={Bookmark}
            />
          </>
        ) : (
          <DeckDone title={saved ? `${pluralize(saved, 'pearl')} saved` : "You're all caught up"} onClose={onClose}>
            {saved ? 'Find them in your Notebook, ready to revise as flashcards.' : 'No new pearls to swipe right now. Check back later!'}
          </DeckDone>
        )}
      </div>
    </Modal>
  );
}

/**
 * Button that opens pearl swipe mode (Ward pages). Hidden while there are no pearls to go
 * through, so an empty Ward doesn't invite you to swipe nothing. `subject` e.g. "Anatomy".
 */
export function SwipePearlsButton({ params, subject, className }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ ...swipePearlsQuery(params), staleTime: 60_000 });
  if (!data?.length) return null;
  const touch = isTouchDevice();
  const label = `${touch ? 'Swipe' : 'Flip'} through ${subject ? `${subject} ` : ''}pearls`;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn('card card-hover flex w-full items-center gap-3 p-3 text-left', className)}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-link">
          <Layers className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{label}</span>
          <span className="muted block text-[13px]">
            {touch ? 'Swipe right to save to your Notebook, left to skip' : 'Save to your Notebook or skip, with the buttons or ← → keys'}
          </span>
        </span>
      </button>
      {open && <PearlSwipeModal params={params} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------- flashcards

/** Front / back for revising a saved post: case → complaint / diagnosis; others → title or first sentence / the rest. */
export function toFlashcard(post) {
  const cs = post.caseStudy;
  if (post.type === 'case_study' && cs?.chiefComplaint && cs?.diagnosis) {
    const who = ageSexLabel(cs);
    return {
      prompt: 'What is the diagnosis?',
      front: `${who ? `${who}. ` : ''}${cs.chiefComplaint}`,
      back: cs.diagnosis,
      extra: cs.learningPoint || '',
    };
  }
  const text = stripMentions(post.content || '').trim();
  if (post.title && text) return { prompt: 'What do you remember about…', front: post.title, back: text, extra: '' };
  const m = text.match(/^(.{20,200}?[.?!:])\s+([\s\S]+)$/);
  if (m) return { prompt: 'Complete the pearl', front: m[1], back: m[2], extra: '' };
  return text ? { prompt: 'Recall the pearl, then tap', front: postTitle(post) || 'Saved pearl', back: text, extra: '' } : null;
}

function FlashcardFace({ card, flipped }) {
  return (
    <div className={cn('flex h-full flex-col p-5 transition-colors', flipped && 'bg-success-soft')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge post={card.post} />
        <SpecialtyPill tag={wardOf(card.post) ?? card.post.tags?.[0]} link={false} />
      </div>
      <p className="muted mt-4 text-[12px] font-semibold uppercase tracking-wide">{flipped ? 'Answer' : card.prompt}</p>
      <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
        <p className={cn('whitespace-pre-wrap break-words leading-snug', flipped ? 'text-[17px] font-semibold' : 'text-[17px] font-semibold')}>
          {flipped ? card.back : card.front}
        </p>
        {flipped && card.extra && <p className="muted mt-3 text-[13px] leading-relaxed">{card.extra}</p>}
      </div>
      <p className="muted mt-3 text-center text-[12px]">{flipped ? 'Tap to see the question again' : 'Tap the card to flip it'}</p>
    </div>
  );
}

const GRADE_BUTTONS = [
  { grade: 'again', label: 'Again', hint: '10 min', cls: 'text-danger' },
  { grade: 'hard', label: 'Hard', hint: 'shorter', cls: 'text-warning' },
  { grade: 'good', label: 'Good', hint: 'normal', cls: 'text-link' },
  { grade: 'easy', label: 'Easy', hint: 'longer', cls: 'text-success' },
];

/**
 * Revise the Notebook with spaced repetition (SM-2, like Anki). Shows the cards due today
 * (optionally one subject). Tap to flip, then grade: Again / Hard / Good / Easy. On phones,
 * swipe right = Good, left = Again. The server schedules each card's next review.
 */
export function FlashcardModal({ tag, title = 'Revise as flashcards', onClose }) {
  const { data, isPending } = useQuery({
    queryKey: ['reviews', 'due', tag ?? ''],
    queryFn: () => api.get('/reviews/due', { params: { limit: 50, ...(tag ? { tag } : {}) } }).then((r) => r.data),
    staleTime: 0,
  });
  const grade = useGradeCard();
  const [queue, setQueue] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const total = useRef(0);

  useEffect(() => {
    if (!data || queue !== null) return;
    const cards = data.posts.map((p) => ({ post: p, card: toFlashcard(p) })).filter((x) => x.card).map((x) => ({ key: x.post._id, post: x.post, ...x.card }));
    total.current = cards.length;
    setQueue(cards);
  }, [data, queue]);

  const answer = (item, g) => {
    grade.mutate({ postId: item.post._id, grade: g });
    setFlipped(false);
    // "Again" comes back later in this session; everything else is done for today.
    setQueue((q) => (g === 'again' ? [...q.slice(1), { ...item, key: `${item.post._id}-again-${Date.now()}` }] : q.slice(1)));
    if (g !== 'again') setDone((n) => n + 1);
  };

  return (
    <Modal open onClose={onClose} title={title} size="max-w-md">
      <div className="p-5">
        {isPending || queue === null ? (
          <div className="flex h-[420px] items-center justify-center"><Spinner /></div>
        ) : data.total === 0 ? (
          <DeckDone icon={Layers} title="Nothing to revise yet" onClose={onClose}>
            Save cases and pearls (the bookmark icon) and they'll turn into flashcards here.
          </DeckDone>
        ) : total.current === 0 ? (
          <DeckDone icon={Check} title="All caught up for today" onClose={onClose}>
            No cards are due. Spaced repetition brings each one back just before you'd forget it, so check back tomorrow.
          </DeckDone>
        ) : queue.length ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-ds-brand transition-[width]" style={{ width: `${(done / total.current) * 100}%` }} />
              </div>
              <span className="muted text-[12px] font-semibold ds-num">{done}/{total.current} due today</span>
            </div>
            <SwipeDeck
              items={queue}
              renderCard={(item) => <FlashcardFace card={item} flipped={item.key === queue[0].key && flipped} />}
              onSwipe={(item, dir) => answer(item, dir === 'right' ? 'good' : 'again')}
              onTap={() => setFlipped((f) => !f)}
              leftLabel="Again"
              rightLabel="Good"
              leftIcon={Undo2}
              rightIcon={Check}
              hideButtons
            />
            {/* grade buttons appear once the answer is shown */}
            {flipped ? (
              <div className="mt-5 grid grid-cols-4 gap-2" role="group" aria-label="How well did you remember it?">
                {GRADE_BUTTONS.map((b) => (
                  <button key={b.grade} onClick={() => answer(queue[0], b.grade)} className="btn-secondary min-h-14 flex-col gap-0 px-1">
                    <span className={cn('text-[13px] font-semibold', b.cls)}>{b.label}</span>
                    <span className="muted text-[12px] font-medium">{b.hint}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button className="btn-primary mt-5 min-h-12 w-full" onClick={() => setFlipped(true)}>Show answer</button>
            )}
            <p className="muted mt-3 text-center text-[12px]">{isTouchDevice() ? 'Swipe right for Good, left for Again' : 'Press → for Good, ← for Again, or use the buttons'}</p>
          </>
        ) : (
          <DeckDone title="Session complete!" onClose={onClose}>
            You revised {pluralize(total.current, 'card')}. Each one will come back when it's due.
          </DeckDone>
        )}
      </div>
    </Modal>
  );
}
