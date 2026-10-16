import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Stethoscope, MessagesSquare, MessageCircle, NotebookPen, Layers, Search, X } from 'lucide-react';
import { api } from '../api/client';
import { PageShell } from '../components/Layout';
import { QuickFlashcard, StudyStreak } from '../components/StudyPanel';
import InfiniteFeed from '../components/InfiniteFeed';
import PostCard from '../components/PostCard';
import NotebookNote from '../components/NotebookNote';
import CommentList from '../components/CommentList';
import { FlashcardModal } from '../components/SwipeDeck';
import { EmptyState } from '../components/ui';
import { useReviewSummary } from '../hooks/useReviews';
import { specialtyMeta } from '../lib/specialties';
import { cn } from '../lib/format';
import { SpecialtyDot } from '../components/ds/display';

const TABS = [
  { id: 'all', label: 'Everything', params: {}, icon: NotebookPen },
  { id: 'cases', label: 'Cases', params: { type: 'case_study' }, icon: Stethoscope },
  { id: 'posts', label: 'Pearls & posts', params: { type: 'text' }, icon: MessagesSquare },
  { id: 'replies', label: 'Replies', icon: MessageCircle },
];

/** Subjects (tags) across everything I've saved, most-used first, for the notebook's subject chips. */
function useNotebookSubjects() {
  const { data } = useQuery({
    queryKey: ['posts', 'saved', 'subjects'],
    queryFn: () => api.get('/posts', { params: { bookmarked: true, limit: 30 } }).then((r) => r.data.posts),
  });
  const counts = new Map();
  for (const p of data ?? []) for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Opens the spaced-repetition session: the cards due today (this subject only, if one is picked). */
function ReviseButton({ subject }) {
  const [open, setOpen] = useState(false);
  const { data } = useReviewSummary();
  const due = data?.due ?? 0;
  return (
    <>
      <button className="btn-primary shrink-0 px-3.5 text-[13px]" onClick={() => setOpen(true)}>
        <Layers className="h-4 w-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">Revise as flashcards</span>
        <span className="sm:hidden">Revise</span>
        {due > 0 && !subject && <span className="ds-num rounded-full bg-white/20 px-1.5 text-[12px] font-medium">{due} due</span>}
      </button>
      {open && (
        <FlashcardModal tag={subject || undefined} title={subject ? `Revise: ${specialtyMeta(subject).label}` : 'Revise as flashcards'} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
/** Search box for the Notebook: looks through saved posts and your own notes; waits for typing to pause. */
function NotebookSearch({ value, onChange, onClose }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => text.trim() !== value && onChange(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ds-fg-3" strokeWidth={1.5} />
      <input
        type="text"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        placeholder="Search your notebook: words in saved posts or your notes"
        className="input py-3 pl-10 pr-11"
        aria-label="Search your notebook"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close search"
        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ds-fg-3 hover:bg-surface-2 hover:text-ink"
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </label>
  );
}

/** Notebook: everything you saved, by subject, with your own private notes (route /notebook). */
export default function Saved() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0];
  const subject = params.get('subject') || '';
  const q = params.get('q') || '';
  const [searching, setSearching] = useState(Boolean(q));
  const subjects = useNotebookSubjects();
  const feedParams = { bookmarked: true, ...tab.params, ...(subject ? { tag: subject } : {}), ...(q ? { q } : {}) };

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const closeSearch = () => {
    setSearching(false);
    update({ q: '' });
  };

  return (
    <PageShell
      cards
      title="Notebook"
      subtitle="Everything you saved, by subject. Only you can see it."
      actions={
        tab.id !== 'replies' && (
          <div className="flex items-center gap-2">
            <button
              className={cn('btn-secondary shrink-0 px-3.5 text-[13px]', searching && 'border-link text-link')}
              onClick={() => (searching ? closeSearch() : setSearching(true))}
              aria-pressed={searching}
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">Search</span>
            </button>
            <ReviseButton subject={subject} />
          </div>
        )
      }
      tabs={
        <div className="px-3 pb-3">
          <div role="tablist" aria-label="Notebook sections" className="segmented">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === tab.id}
                onClick={() => update({ tab: t.id === 'all' ? '' : t.id })}
                className={cn('segment inline-flex flex-1 items-center justify-center gap-1.5', t.id === tab.id && 'segment-active')}
              >
                <t.icon className="h-4 w-4" strokeWidth={1.5} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      }
      rail={<><QuickFlashcard /><StudyStreak /></>}
    >
      {tab.id !== 'replies' && searching && <NotebookSearch value={q} onChange={(v) => update({ q: v })} onClose={closeSearch} />}

      {tab.id !== 'replies' && subjects.length > 0 && (
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-0.5">
          {[['', null], ...subjects].map(([s, n]) => {
            const active = subject === s;
            const m = s ? specialtyMeta(s) : null;
            return (
              <button
                key={s || 'all'}
                onClick={() => update({ subject: s })}
                aria-pressed={active}
                className={cn(
                  'chip min-h-9 shrink-0 px-3 text-[13px] capitalize transition active:scale-[0.98]',
                  active ? 'border-link bg-ds-brand-soft text-link' : 'bg-surface text-ds-fg-2 hover:bg-surface-2 hover:text-ink'
                )}
              >
                {m && <SpecialtyDot hue={m.hue} />}
                {m ? m.short : 'All subjects'}
                {n != null && <span className="ds-num font-code text-[12px] text-ds-fg-3">{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {tab.id === 'replies' ? (
        <div className="card overflow-clip">
          <CommentList
            queryKey={['saved-comments']}
            url="/users/me/saved-comments"
            empty={
              <EmptyState icon={MessageCircle} title="No saved replies">
                Tap the <Bookmark className="inline h-4 w-4 align-text-bottom" /> bookmark under any comment to keep it here.
              </EmptyState>
            }
          />
        </div>
      ) : (
        <InfiniteFeed
          key={`${tab.id}-${subject}-${q}`}
          variant="cards"
          queryKey={['posts', 'saved', 'page', tab.id, subject, q]}
          params={feedParams}
          renderItem={(post) => (
            <>
              <PostCard post={post} />
              <NotebookNote post={post} />
            </>
          )}
          empty={q ? (
            <EmptyState icon={Search} title={`Nothing in your notebook matches "${q}"`}>
              Try a different word, or pick "All subjects" and "Everything" to search all you've saved.
            </EmptyState>
          ) : (
            <EmptyState
              icon={tab.icon}
              title={subject ? `Nothing saved in ${specialtyMeta(subject).label} yet` : 'Your notebook is empty'}
              action={<Link to="/cases" className="btn-primary"><Stethoscope className="h-4 w-4" strokeWidth={1.75} /> Browse cases</Link>}
            >
              Tap the <Bookmark className="inline h-4 w-4 align-text-bottom" /> bookmark on any case or pearl. It lands here and becomes a flashcard you can revise.
            </EmptyState>
          )}
        />
      )}
    </PageShell>
  );
}
