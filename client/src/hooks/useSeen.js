import { useEffect, useRef } from 'react';
import { api } from '../api/client';

// A post or comment counts as viewed once at least half of it has been on screen for a second.
// Seen ids are batched into one POST /posts/views; the server counts each member once per item per day.
const VISIBLE_RATIO = 0.5;
const VISIBLE_MS = 1000;
const FLUSH_MS = 2000;

const sent = new Set(); // per page load: never report the same item twice
const queue = { posts: new Set(), comments: new Set() };
let flushTimer = null;

function flush() {
  flushTimer = null;
  const posts = [...queue.posts];
  const comments = [...queue.comments];
  queue.posts.clear();
  queue.comments.clear();
  if (posts.length || comments.length) api.post('/posts/views', { posts, comments }).catch(() => {});
}

function report(kind, id) {
  const key = `${kind}:${id}`;
  if (sent.has(key)) return;
  sent.add(key);
  queue[kind === 'post' ? 'posts' : 'comments'].add(id);
  flushTimer ??= setTimeout(flush, FLUSH_MS);
}

if (typeof window !== 'undefined') {
  // Don't lose the last batch when the tab is hidden or closed.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushTimer && (clearTimeout(flushTimer), flush()));
}

/** Returns a ref to put on the card's root element. `kind` is 'post' or 'comment'. */
export function useSeen(kind, id) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !id || sent.has(`${kind}:${id}`) || typeof IntersectionObserver === 'undefined') return undefined;
    let timer = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // a card taller than two screens can never be half visible: then filling half the screen counts
        const seen = entry.intersectionRatio >= VISIBLE_RATIO || entry.intersectionRect.height >= window.innerHeight * VISIBLE_RATIO;
        if (entry.isIntersecting && seen) {
          timer ??= setTimeout(() => {
            report(kind, id);
            observer.disconnect();
          }, VISIBLE_MS);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }
    );
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [kind, id]);
  return ref;
}
