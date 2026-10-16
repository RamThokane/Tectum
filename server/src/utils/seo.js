// What the server needs to know about the web app's pages: which addresses exist (anything else
// gets HTTP 404 while still showing the app's own "Page not found"), what crawlers may index,
// and which pages go in the sitemap. Keep in step with client/src/App.jsx and lib/legal.js.

const LEGAL_DOCS = ['terms', 'privacy', 'guidelines', 'advertising', 'grievance'];
const ID = '[a-f\\d]{24}';
const SLUG = '[a-z0-9-]{1,60}';

const ROUTES = [
  '/', '/login', '/signup', '/forgot-password', '/reset-password', '/legal', `/legal/(?:${LEGAL_DOCS.join('|')})`,
  '/home', '/feed', '/collaboration', '/wards', `/ward/${SLUG}`, '/cases', `/cases/${ID}`, '/notes',
  `/post/${ID}`, `/profile/${ID}`, '/discover', `/topic/${SLUG}`, '/search', '/notifications',
  '/messages', `/messages/${ID}`, '/admin', '/settings', '/notebook', '/privacy-demo', '/saved', '/styleguide',
  // tests
  '/quiz', '/quiz/create', '/quiz/join', `/quiz/${ID}/(?:edit|manage|instructions)`, `/quiz/${ID}/results/${ID}`,
  `/quiz/attempt/${ID}`, `/quiz/attempt/${ID}/result`,
].map((r) => new RegExp(`^${r}/?$`, 'i'));

/** True if the web app has a page at this path. */
export const isKnownPage = (pathname) => ROUTES.some((rx) => rx.test(pathname));

/** Public pages for the sitemap (everything else needs an account). */
export const PUBLIC_PAGES = ['/', '/signup', '/login', ...LEGAL_DOCS.map((d) => `/legal/${d}`)];

// Signed-in parts of the app: nothing there is useful (or visible) to a crawler.
const PRIVATE_PREFIXES = ['/home', '/feed', '/collaboration', '/wards', '/ward/', '/cases', '/post/', '/profile/', '/discover',
  '/topic/', '/search', '/notifications', '/messages', '/admin', '/settings', '/notebook', '/saved', '/privacy-demo',
  '/reset-password', '/styleguide', '/quiz', '/api/'];

export function robotsTxt(origin) {
  return ['User-agent: *', ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`), 'Allow: /', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
}

export function sitemapXml(origin, lastmod = new Date().toISOString().slice(0, 10)) {
  const urls = PUBLIC_PAGES.map(
    (p) => `  <url><loc>${origin}${p}</loc><lastmod>${lastmod}</lastmod><changefreq>${p === '/' ? 'weekly' : 'monthly'}</changefreq></url>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** The page's canonical address: no query string, no trailing slash (except the home page). */
export const canonicalFor = (origin, pathname) => `${origin}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`;

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** index.html with this page's <link rel="canonical"> written in (for crawlers that don't run JS). */
export function withCanonical(html, href) {
  const tag = `<link rel="canonical" href="${escapeAttr(href)}" />`;
  return /<link rel="canonical"[^>]*>/.test(html) ? html.replace(/<link rel="canonical"[^>]*>/, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}
