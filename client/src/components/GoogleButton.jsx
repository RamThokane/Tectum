import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useUIStore } from '../store/ui';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise = null;

/** Loads Google's sign-in script once per browser session. */
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = SCRIPT_SRC;
      el.async = true;
      el.onload = resolve;
      el.onerror = () => {
        scriptPromise = null;
        reject(new Error('Google sign-in could not be loaded'));
      };
      document.head.appendChild(el);
    });
  }
  return scriptPromise;
}

/** Whether "Continue with Google" is switched on for this server (GOOGLE_CLIENT_ID is set). */
export function useGoogleClientId() {
  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.get('/config').then((r) => r.data),
    staleTime: Infinity,
    retry: false,
  });
  return data?.googleClientId || '';
}

/**
 * Google's own "Sign in with Google" button. `onCredential` receives the one-time
 * credential to hand to POST /auth/google. Renders nothing when Google isn't configured.
 *
 * When the visitor is already signed in to Google in this browser, Google shows the button as
 * "Continue as <name>" with their photo, and `oneTap` also offers One Tap: a small
 * "Continue as <name>" card in the corner, so one tap signs them in or starts their sign-up.
 * `context` ('signin' | 'signup') sets One Tap's wording.
 */
export default function GoogleButton({ onCredential, text = 'continue_with', disabled = false, oneTap = false, context = 'signin' }) {
  const clientId = useGoogleClientId();
  const theme = useUIStore((s) => s.theme);
  const holder = useRef(null);
  const latest = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  latest.current = onCredential;

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => credential && latest.current?.(credential),
          context,
          ux_mode: 'popup',
          // FedCM: the browser's own Google account chooser. Chrome requires it now that
          // third-party cookies are blocked; other browsers fall back to Google's iframe.
          use_fedcm_for_prompt: true,
          use_fedcm_for_button: true,
          itp_support: true, // One Tap in Safari / Firefox too
          cancel_on_tap_outside: true,
          auto_select: false, // always one tap from the person, never silent
        });
        holder.current.innerHTML = '';
        window.google.accounts.id.renderButton(holder.current, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width: 320,
          logo_alignment: 'center',
        });
        // One Tap: only shows if the browser has a signed-in Google account (else nothing happens).
        if (oneTap) window.google.accounts.id.prompt();
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      // leaving the page closes the One Tap card
      if (oneTap) window.google?.accounts?.id?.cancel();
    };
  }, [clientId, theme, text, oneTap, context]);

  if (!clientId) return null;
  if (failed) {
    return <p className="muted text-center text-[12px]">Google sign-in is unavailable right now. Use your email and password below.</p>;
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined}>
      <div ref={holder} className="flex justify-center [color-scheme:light]" />
    </div>
  );
}

/** "or" divider used between the Google button and the email form. */
export function AuthDivider({ children = 'or' }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[12px] text-ds-fg-3">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
