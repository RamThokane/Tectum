export function timeAgo(date) {
  const d = new Date(date);
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.floor(s / 60) || 1}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export const fullDate = (date) =>
  new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function compact(n = 0) {
  if (n < 1000) return String(n);
  if (n < 1e6) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
}

/**
 * The word for a count: plural('follower', 1) -> "follower", plural('follower', 2) -> "followers".
 * Irregular plurals: plural('entry', n, 'entries').
 */
export const plural = (word, n, many = `${word}s`) => (Number(n) === 1 ? word : many);

/** Count + word: pluralize(1, 'follower') -> "1 follower"; pluralize(1200, 'view') -> "1.2K views". */
export const pluralize = (n, word, many) => `${compact(Number(n) || 0)} ${plural(word, n, many)}`;

/**
 * Shortens text to at most `max` characters, cutting at a word boundary and adding "…",
 * so a snippet never stops mid-word ("…He has" stays a whole word, followed by the ellipsis).
 */
export function truncateWords(text = '', max = 120) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : clean.slice(0, max)).replace(/[\s,;:.\-–—]+$/, '');
  return `${base}…`;
}

export const formatBytes = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

export const cn = (...parts) => parts.filter(Boolean).join(' ');

// Mentions are stored as "@[Display Name](userId)".
export const MENTION_TOKEN = /@\[([^\]\n]{1,80})\]\(([a-f\d]{24})\)/gi;
/** Plain-text version of a post/comment for previews: "@[Priya](id)" -> "@Priya". */
export const stripMentions = (text = '') => text.replace(MENTION_TOKEN, (_m, name) => `@${name}`);

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';
