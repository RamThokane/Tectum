import { useEffect, useRef, useState } from 'react';
import { fullscreenElement, isMobileDevice } from '../lib/quiz';

/**
 * Test proctoring while an attempt runs (`active`). Watches for, and reports via onViolation(type, meta):
 *   FULLSCREEN_EXIT  full screen was left (Esc can't be blocked by any website - it's detected instead)
 *   TAB_SWITCH       the page was hidden (another tab, minimised)
 *   WINDOW_BLUR      another window/app took focus (checked after 1 s, so browser pop-ups don't count)
 * and blocks + logs (never disqualifying): right-click, copy/cut/paste, text selection, dragging,
 * Ctrl/Cmd + C V X A P S U, F12, Ctrl+Shift+I/J/C, PrintScreen; best-effort developer-tools check.
 * The SERVER decides what each violation means; this only reports. Everything is removed when the
 * test ends or the page closes.
 */
const BLOCKED_KEYS = new Set(['c', 'v', 'x', 'a', 'p', 's', 'u']);
const LOG_ONLY_EVERY_MS = 5000;

export function useProctoring({ active, onViolation, phone = false }) {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(fullscreenElement()));
  const report = useRef(onViolation);
  useEffect(() => {
    report.current = onViolation;
  });

  // Always track whether we're in full screen (also while the test is still loading), so the
  // "return to full screen" screen never shows by mistake. Violations are reported only when active.
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(fullscreenElement()));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    const settle = setTimeout(sync, 0);
    return () => {
      clearTimeout(settle);
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const lastLog = {};
    const logOnly = (type, meta) => {
      const now = Date.now();
      if (now - (lastLog[type] ?? 0) < LOG_ONLY_EVERY_MS) return;
      lastLog[type] = now;
      report.current?.(type, meta);
    };
    let lastHiddenAt = 0;
    let blurTimer = null;

    const onFullscreenChange = () => {
      if (!fullscreenElement()) report.current?.('FULLSCREEN_EXIT', 'left full screen');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt = Date.now();
        report.current?.('TAB_SWITCH', 'page hidden (tab switched or window minimised)');
      }
    };
    const onBlur = () => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        // the same switch already counted as a tab switch, or focus came straight back
        if (document.visibilityState === 'hidden' || Date.now() - lastHiddenAt < 1500 || document.hasFocus()) return;
        report.current?.('WINDOW_BLUR', 'another window or app took focus');
      }, 1000);
    };
    const onFocus = () => clearTimeout(blurTimer);

    const inField = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    const onContextMenu = (e) => {
      e.preventDefault();
      logOnly('CONTEXT_MENU', 'right-click');
    };
    const onClipboard = (e) => {
      e.preventDefault();
      logOnly('COPY_PASTE', e.type);
    };
    const onSelectStart = (e) => !inField(e) && e.preventDefault();
    const onDragStart = (e) => e.preventDefault();
    const onKeyDown = (e) => {
      const k = e.key?.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const devtools = (mod && e.shiftKey && ['i', 'j', 'c'].includes(k)) || k === 'f12';
      if ((mod && BLOCKED_KEYS.has(k)) || devtools || k === 'printscreen') {
        e.preventDefault();
        e.stopPropagation();
        logOnly('SHORTCUT_BLOCKED', `${mod ? (e.metaKey ? 'Cmd+' : 'Ctrl+') : ''}${e.shiftKey && mod ? 'Shift+' : ''}${e.key}`);
      }
    };
    const onKeyUp = (e) => {
      // PrintScreen often only reaches the page on key-up (Windows): log it and wipe the clipboard
      if (e.key === 'PrintScreen') {
        logOnly('SHORTCUT_BLOCKED', 'PrintScreen');
        navigator.clipboard?.writeText?.('').catch(() => {});
      }
    };
    const onBeforePrint = () => logOnly('SHORTCUT_BLOCKED', 'print');
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    // iPhone mode: Safari may freeze the page without a visibility change (e.g. swiping to
    // another app quickly) - pagehide still fires.
    const onPageHide = () => {
      if (Date.now() - lastHiddenAt > 1500) report.current?.('TAB_SWITCH', 'left the page (app or tab switched)');
    };
    // Developer tools, best effort: a docked panel makes the window's outer size much bigger than
    // the page. Logged once; never relied on.
    // (not on phones: their browser bars make the window taller than the page anyway)
    let devtoolsLogged = isMobileDevice();
    const devtoolsCheck = setInterval(() => {
      if (devtoolsLogged || fullscreenElement()) return;
      if (window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 250) {
        devtoolsLogged = true;
        report.current?.('DEVTOOLS', 'window much bigger than the page (developer tools open?)');
      }
    }, 2000);

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onClipboard);
    document.addEventListener('cut', onClipboard);
    document.addEventListener('paste', onClipboard);
    document.addEventListener('selectstart', onSelectStart);
    document.addEventListener('dragstart', onDragStart);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('beforeunload', onBeforeUnload);
    if (phone) window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      clearTimeout(blurTimer);
      clearInterval(devtoolsCheck);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onClipboard);
      document.removeEventListener('cut', onClipboard);
      document.removeEventListener('paste', onClipboard);
      document.removeEventListener('selectstart', onSelectStart);
      document.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [active, phone]);

  return { isFullscreen };
}
