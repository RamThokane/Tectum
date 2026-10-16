import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Router-level scroll handling (BrowserRouter has no <ScrollRestoration/>):
//  - a new page (PUSH / REPLACE to another pathname) opens at the top;
//  - Back / Forward (POP) returns to where that page was left.
const positions = new Map(); // location.key -> scrollY
const MAX_WAIT_MS = 1500; // a restored page may still be loading; keep trying this long

// While a dialog is open the body is pinned (useScrollLock), so window.scrollY reads 0.
const bodyLocked = () => document.body.style.position === 'fixed';

export function useScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  // The entry on screen right now. Updated in the layout effect below, i.e. before the new page's
  // scroll-to-top fires a scroll event; the old page's listener (only removed later, after paint)
  // checks it so it can't overwrite its saved position with the new page's 0.
  const activeKey = useRef(location.key);

  // Remember this entry's position as the member scrolls.
  useEffect(() => {
    const key = location.key;
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => activeKey.current === key && !bodyLocked() && positions.set(key, window.scrollY));
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', save);
    };
  }, [location.key]);

  // Only the pathname decides "new page": changing ?tab= or ?q= on the same page keeps the position.
  const lastPath = useRef(location.pathname);
  useLayoutEffect(() => {
    activeKey.current = location.key;
    const samePage = lastPath.current === location.pathname;
    lastPath.current = location.pathname;
    if (navType !== 'POP') {
      if (!samePage) window.scrollTo(0, 0);
      return undefined;
    }
    const target = positions.get(location.key) ?? 0;
    const started = performance.now();
    let frame = 0;
    const tryRestore = () => {
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target;
      if (reachable || performance.now() - started > MAX_WAIT_MS) {
        window.scrollTo(0, target);
      } else {
        frame = requestAnimationFrame(tryRestore);
      }
    };
    tryRestore();
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run per pathname / history entry only
  }, [location.pathname, location.key]);
}
