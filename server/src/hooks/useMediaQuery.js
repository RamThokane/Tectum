import { useSyncExternalStore } from 'react';

/** True while the CSS media query matches, e.g. useMediaQuery('(min-width: 1280px)'). */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Tailwind's xl breakpoint: the right rail (and anything only it shows) exists from here up. */
export const RAIL_QUERY = '(min-width: 1280px)';
