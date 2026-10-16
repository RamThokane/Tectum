import { useSyncExternalStore } from 'react';

/**
 * "Add Tectum to your home screen" (the site is already installable: public/manifest.webmanifest +
 * public/sw.js). Chrome, Edge, Samsung Internet and other Chromium browsers offer a real install
 * prompt (`beforeinstallprompt`), which fires early - so it's caught here from main.jsx, before
 * React mounts. Safari (iPhone, iPad, Mac) and Firefox have no prompt: the member is shown the
 * steps for their browser instead.
 */
let deferred = null;
let installedNow = false;
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // our own pop-up asks instead of the browser's bar
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => `${Boolean(deferred)}:${installedNow}`;
/** { canPrompt, installedNow } - re-renders when the browser's prompt becomes available or is used. */
export function useInstallState() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [canPrompt, installed] = s.split(':');
  return { canPrompt: canPrompt === 'true', installedNow: installed === 'true' };
}

/** Shows the browser's own install dialog. Resolves 'accepted', 'dismissed' or 'unavailable'. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  notify();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') {
      installedNow = true;
      notify();
    }
    return outcome;
  } catch {
    return 'unavailable';
  }
}

/** Opened from the home-screen / desktop icon (not in a browser tab)? */
export const isStandalone = () => {
  try {
    return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches) || window.navigator.standalone === true;
  } catch {
    return false;
  }
};

/**
 * Which instructions fit this device:
 *   ios-safari | ios-other (Chrome/Firefox/Edge on iPhone/iPad) | android | mac-safari |
 *   desktop-chrome | desktop-edge | desktop-firefox | other
 */
export function platform() {
  const ua = navigator.userAgent;
  // iPads say "Macintosh" by default; a touch screen gives them away
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  if (/Edg\//i.test(ua)) return 'desktop-edge';
  if (/Firefox\//i.test(ua)) return 'desktop-firefox';
  if (/Chrome\//i.test(ua)) return 'desktop-chrome';
  if (/Macintosh/i.test(ua) && /Safari\//i.test(ua)) return 'mac-safari';
  return 'other';
}

export const isPhoneOrTablet = () => ['ios-safari', 'ios-other', 'android'].includes(platform());
