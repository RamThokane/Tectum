// Custom SVG icons for the places that used emojis as UI (🔥 streak, 🤝 collaboration, 🎓 study).
// Drawn on Lucide's 24px grid with a 1.5px stroke so they sit naturally beside Lucide icons.
import { useId } from 'react';

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };

/** Study streak: a coral flame with a warm inner core (replaces 🔥). `lit={false}` = no streak yet. */
export function StreakFlame({ size = 20, lit = true, className, title }) {
  const id = useId();
  return (
    <svg {...base} width={size} height={size} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-g`} x1="12" y1="3" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffb199" />
          <stop offset="1" stopColor="#f97362" />
        </linearGradient>
      </defs>
      <path
        d="M12 3c.6 2.6 2.4 4 3.8 5.6C17.2 10.2 18 12 18 14a6 6 0 0 1-12 0c0-2 .9-3.4 2-4.6.3 1.4 1 2.3 2 2.8C9.6 9 10.6 5.6 12 3Z"
        fill={lit ? `url(#${id}-g)` : 'none'}
        stroke={lit ? '#e2594a' : 'currentColor'}
      />
      {lit && <path d="M12 12.5c.9 1 1.8 1.8 1.8 3.1a1.8 1.8 0 1 1-3.6 0c0-1.2.9-2 1.8-3.1Z" fill="#fff6f2" stroke="none" opacity=".9" />}
    </svg>
  );
}

/** Collaboration: two hands meeting (replaces 🤝). */
export function CollabIcon({ size = 20, className }) {
  return (
    <svg {...base} width={size} height={size} stroke="currentColor" className={className} aria-hidden="true">
      <path d="M3 11.5 6.5 8l3 1.2L12 8l4.5 3.5" />
      <path d="M21 11.5 17.5 8" />
      <path d="M7.5 14.5 10 17a1.4 1.4 0 0 0 2-2l-2.2-2.2" />
      <path d="m11.8 14.8 1.7 1.7a1.4 1.4 0 0 0 2-2l-1.7-1.7" />
      <path d="m13.8 12.8 1.2 1.2a1.4 1.4 0 0 0 2-2L13 8.2" />
      <path d="M3 11.5 7.5 16" />
    </svg>
  );
}

/** Study / students: a mortarboard with a tassel (replaces 🎓). */
export function StudyIcon({ size = 20, className }) {
  return (
    <svg {...base} width={size} height={size} stroke="currentColor" className={className} aria-hidden="true">
      <path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z" />
      <path d="M6.5 11v4.2c0 1.3 2.5 2.8 5.5 2.8s5.5-1.5 5.5-2.8V11" />
      <path d="M21.5 9v5" />
      <circle cx="21.5" cy="15.5" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Verified: a shield with a check, used inside role badges. */
export function VerifiedShield({ size = 14, className, title = 'Verified' }) {
  return (
    <svg {...base} width={size} height={size} stroke="currentColor" strokeWidth={1.8} className={className} role="img" aria-label={title}>
      <path d="M12 3 5 6v5.5c0 4.2 3 7.6 7 9.5 4-1.9 7-5.3 7-9.5V6l-7-3Z" fill="currentColor" fillOpacity=".14" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </svg>
  );
}
