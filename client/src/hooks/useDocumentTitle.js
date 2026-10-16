import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_NAME = 'Tectum';
const DEFAULT_TITLE = 'Tectum · Learn medicine one real case at a time';

/** Sets the tab title to "<title> · Tectum" while the page is shown ("Case Rounds · Tectum"). */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    document.title = `${title} · ${SITE_NAME}`;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}

/**
 * Keeps <link rel="canonical"> pointing at this page's own address (no query string, no
 * trailing slash), so search engines index one URL per page. The server writes the same
 * link into the HTML for crawlers that don't run JavaScript.
 */
export function useCanonicalLink() {
  const { pathname } = useLocation();
  useEffect(() => {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = `${window.location.origin}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`;
  }, [pathname]);
}
