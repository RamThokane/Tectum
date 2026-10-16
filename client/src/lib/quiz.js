/** Shared bits for the Tests section (pages/quiz, components/quiz). */

/** A 24-character hex id, like the database's, so new questions/options can be referenced before saving. */
export function newId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const QUESTION_TYPES = [
  { value: 'single', label: 'Single answer', hint: 'One correct option' },
  { value: 'multiple', label: 'Multiple answers', hint: 'One or more correct options' },
  { value: 'truefalse', label: 'True / False', hint: '' },
  { value: 'short', label: 'Short answer', hint: 'Typed word or number' },
];
export const typeLabel = (t) => QUESTION_TYPES.find((x) => x.value === t)?.label ?? t;

export const PHASES = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  live: { label: 'Live', tone: 'success' },
  ended: { label: 'Ended', tone: 'muted' },
};

export const ATTEMPT_STATUS = {
  in_progress: { label: 'In progress', tone: 'info' },
  submitted: { label: 'Completed', tone: 'success' },
  auto_submitted: { label: 'Auto-submitted', tone: 'warning' },
  disqualified: { label: 'Disqualified', tone: 'danger' },
  voided: { label: 'Set aside (retake)', tone: 'muted' },
};

export const VIOLATION_LABELS = {
  FULLSCREEN_EXIT: 'Left full screen',
  TAB_SWITCH: 'Switched tab / minimised',
  WINDOW_BLUR: 'Switched window or app',
  SESSION_LOST: 'Closed or reloaded the page',
  MULTIPLE_SESSION: 'Opened in another tab / device',
  SHORTCUT_BLOCKED: 'Blocked shortcut',
  CONTEXT_MENU: 'Right-click',
  COPY_PASTE: 'Copy / paste attempt',
  DEVTOOLS: 'Developer tools (possible)',
  FULLSCREEN_UNSUPPORTED: 'Full screen not supported',
};

// ---- dates: stored in UTC, shown in the member's own time zone (India Standard Time for most) ----
const zone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
})();
const zoneShort = (() => {
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
})();
const dtf = new Intl.DateTimeFormat('en-IN', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const tf = new Intl.DateTimeFormat('en-IN', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/** "Tue 14 Oct, 6:30 pm IST" */
export const fmtDateTime = (d) => (d ? `${dtf.format(new Date(d))}${zoneShort ? ` ${zoneShort}` : ''}` : '');
/** "10:42:13" */
export const fmtClock = (d) => (d ? tf.format(new Date(d)) : '');

/** For <input type="datetime-local"> (local time, no seconds). */
export function toLocalInput(d) {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

/** 75 -> "1 min 15 s", 3700 -> "1 h 1 min" */
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h} h${m ? ` ${m} min` : ''}`;
  if (m) return `${m} min${r ? ` ${r} s` : ''}`;
  return `${r} s`;
}
/** Countdown display: 01:05:09 or 05:09 */
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** "ab cd ef 23" -> "ABCDEF23" (same as the server). */
export const normalizeCode = (raw) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

// ---- import templates ----
export const CSV_TEMPLATE = [
  'type,question,option1,option2,option3,option4,option5,option6,correct,marks,negative_marks,explanation,image,time_limit_sec,tolerance',
  'single,"Drug of choice for absence seizures?",Ethosuximide,Phenytoin,Carbamazepine,Phenobarbitone,,,1,4,1,"Ethosuximide blocks T-type calcium channels.",,,',
  'multiple,"Which are loop diuretics?",Furosemide,Bumetanide,Spironolactone,Torsemide,,,1;2;4,4,0,,,,',
  'truefalse,"Aspirin irreversibly inhibits COX.",,,,,,,True,1,0,,,,',
  'short,"Normal arterial pH (one decimal)?",,,,,,,7.4,2,0,,,,0.05',
].join('\r\n');

export const JSON_TEMPLATE = JSON.stringify(
  [
    { type: 'single', question: 'Drug of choice for absence seizures?', options: ['Ethosuximide', 'Phenytoin', 'Carbamazepine', 'Phenobarbitone'], correct: [1], marks: 4, negativeMarks: 1, explanation: 'Ethosuximide blocks T-type calcium channels.' },
    { type: 'multiple', question: 'Which are loop diuretics?', options: ['Furosemide', 'Bumetanide', 'Spironolactone', 'Torsemide'], correct: [1, 2, 4], marks: 4 },
    { type: 'truefalse', question: 'Aspirin irreversibly inhibits COX.', correct: 'True', marks: 1 },
    { type: 'short', question: 'Normal arterial pH (one decimal)?', correct: ['7.4'], tolerance: 0.05, marks: 2 },
  ],
  null,
  2
);

export function downloadText(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Is the Fullscreen API usable here? (iPhone Safari: no) */
export const fullscreenSupported = () =>
  typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true);
// iPads say "Macintosh" (desktop Safari) by default; a touch screen gives them away.
const isIPad = () => /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
export const isMobileDevice = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || isIPad();
/**
 * Full screen switched OFF for now (iPads had trouble with it): every device takes the test in the
 * no-full-screen mode below; all the other checks stay. Set to true (and FULLSCREEN_REQUIRED in
 * server/src/utils/quizAttempts.js) to bring it back.
 */
export const FULLSCREEN_REQUIRED = false;
/**
 * iPhone mode: phones whose browser has no full screen for web pages (iPhone Safari, and every
 * iPhone browser since they all use Safari's engine). The test runs without full screen; leaving
 * the page (another app, tab, the home screen) is what gets detected and counted instead.
 */
export const isPhoneMode = () => !FULLSCREEN_REQUIRED || (isMobileDevice() && !fullscreenSupported());
export const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
export function enterFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn) return Promise.reject(new Error('Full screen is not supported here'));
  const r = fn.call(el, { navigationUI: 'hide' });
  return r && typeof r.then === 'function' ? r : Promise.resolve();
}
export function exitFullscreen() {
  if (!fullscreenElement()) return;
  (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
}

/** Session token of a running attempt (this tab only). */
export const sessionKey = (attemptId) => `tectum.quiz.session.${attemptId}`;
export const readSession = (attemptId) => {
  try {
    return sessionStorage.getItem(sessionKey(attemptId));
  } catch {
    return null;
  }
};
export const writeSession = (attemptId, token) => {
  try {
    sessionStorage.setItem(sessionKey(attemptId), token);
  } catch {
    /* private mode: the request header still carries it for this page's life */
  }
};
