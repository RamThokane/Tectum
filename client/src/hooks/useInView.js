import { useCallback, useEffect, useState } from 'react';

/**
 * Returns [ref, inView] - used as the infinite-scroll sentinel.
 * `ref` is a callback ref, so watching starts whenever the element appears. (Lists first render
 * a loading skeleton without the sentinel; a plain ref read once on mount never saw it, so
 * "load more" silently never fired and feeds stopped after the first page.)
 */
export function useInView({ rootMargin = '600px' } = {}) {
  const [el, setEl] = useState(null);
  const [inView, setInView] = useState(false);
  const ref = useCallback((node) => setEl(node), []);

  useEffect(() => {
    if (!el) {
      setInView(false);
      return undefined;
    }
    const obs = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [el, rootMargin]);

  return [ref, inView];
}
