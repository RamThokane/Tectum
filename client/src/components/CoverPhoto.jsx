import { cldUrl } from '../lib/cldUrl';

// Banners are at most ~700 x 234 CSS px (the centre column); fetched at 2x, cropped to the subject.
const coverUrl = (src) => (src ? cldUrl(src, { w: 700, h: 234, gravity: 'auto' }) : '');
import { cn } from '../lib/format';

/** Fallback colour behind cover photos while they load. */
export const COVER_GRADIENT = 'bg-brand-gradient';

/**
 * Default banner: a deep blue mesh (blue, a touch of indigo and coral, as in the app's
 * backdrop) with one faint heartbeat line, until the member uploads their own cover in Settings.
 */
function DefaultCover() {
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 600 200" aria-hidden="true">
      <defs>
        <radialGradient id="cov-a" cx="12%" cy="15%" r="75%">
          <stop offset="0" stopColor="#3b82f6" stopOpacity="0.6" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cov-b" cx="88%" cy="25%" r="65%">
          <stop offset="0" stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cov-c" cx="60%" cy="120%" r="65%">
          <stop offset="0" stopColor="#f97362" stopOpacity="0.3" />
          <stop offset="1" stopColor="#f97362" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="200" fill="#0f2a5c" />
      <rect width="600" height="200" fill="url(#cov-a)" />
      <rect width="600" height="200" fill="url(#cov-b)" />
      <rect width="600" height="200" fill="url(#cov-c)" />
      <path d="M0 132 H230 L246 132 L256 108 L270 158 L284 84 L298 146 L308 132 H600" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Banner strip behind a profile header: the member's own cover photo when they've
 * chosen one, otherwise the default gradient mesh.
 */
export default function CoverPhoto({ user, className }) {
  const url = coverUrl(user?.coverPhoto);
  return (
    <div
      className={cn('relative overflow-hidden bg-cover bg-center', url && COVER_GRADIENT, className)}
      style={url ? { backgroundImage: `url("${url}")` } : undefined}
      role={url ? 'img' : undefined}
      aria-label={url ? `${user?.name || 'Profile'} cover photo` : undefined}
    >
      {!url && <DefaultCover />}
    </div>
  );
}

/**
 * Same photo as a full-bleed backdrop for panels with text on top (the home welcome
 * banner). The dark wash keeps white text readable over any photo.
 */
export function CoverBackdrop({ user }) {
  const url = coverUrl(user?.coverPhoto);
  if (!url) return null;
  return (
    <>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} aria-hidden="true" />
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
    </>
  );
}
