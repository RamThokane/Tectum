import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, Download, MoreVertical, Share, SquarePlus, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import { Modal } from './ui';
import { isPhoneOrTablet, isStandalone, platform, promptInstall, useInstallState } from '../lib/installApp';

/** Saves the member's answer ('later' | 'installed') and updates the signed-in user right away. */
function useSaveShortcut() {
  const setUser = useAuthStore((s) => s.setUser);
  return async (status) => {
    setUser({ appShortcut: status });
    try {
      const { data } = await api.put('/users/me/app-shortcut', { status });
      setUser({ appShortcut: data.appShortcut });
    } catch {
      /* offline: asked again next time */
    }
  };
}

/**
 * Notices the shortcut being added: the browser's "installed" signal, or Tectum opened from the
 * home-screen icon (the only sign Safari gives). Mounted once in the app frame.
 */
export function useTrackAppShortcut() {
  const me = useAuthStore((s) => s.user);
  const { installedNow } = useInstallState();
  const save = useSaveShortcut();
  const done = me?.appShortcut === 'installed';
  useEffect(() => {
    if (me && !done && (installedNow || isStandalone())) save('installed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(me), done, installedNow]);
}

const STEP_ICON = 'inline h-4 w-4 align-[-3px] text-ds-brand-text';

/** The steps for browsers without an install prompt (Safari, Firefox, some Android browsers). */
function Steps() {
  const p = platform();
  if (p === 'ios-safari' || p === 'ios-other') {
    return (
      <ol className="list-decimal space-y-2.5 pl-5 text-[15px] leading-6 text-ink">
        <li>
          Tap the <strong>Share</strong> button <Share className={STEP_ICON} aria-label="Share" />{' '}
          {p === 'ios-safari' ? '(at the bottom of the screen on iPhone, at the top on iPad).' : '(in the address bar or the browser menu).'}
        </li>
        <li>
          Scroll down and tap <strong>Add to Home Screen</strong> <SquarePlus className={STEP_ICON} aria-hidden="true" />.
        </li>
        <li>Tap <strong>Add</strong> in the top corner. The Tectum icon appears on your home screen.</li>
        {p === 'ios-other' && <li className="text-ds-fg-2">Don't see it? Open www.tectum.co.in in <strong>Safari</strong> and do the same there.</li>}
      </ol>
    );
  }
  if (p === 'android') {
    return (
      <ol className="list-decimal space-y-2.5 pl-5 text-[15px] leading-6 text-ink">
        <li>
          Tap the browser menu <MoreVertical className={STEP_ICON} aria-label="menu" /> (top or bottom corner).
        </li>
        <li>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li>
        <li>Tap <strong>Add</strong> / <strong>Install</strong>. The Tectum icon appears on your home screen.</li>
      </ol>
    );
  }
  if (p === 'mac-safari') {
    return (
      <ol className="list-decimal space-y-2.5 pl-5 text-[15px] leading-6 text-ink">
        <li>In the menu bar at the top of the screen, click <strong>File</strong>.</li>
        <li>Click <strong>Add to Dock…</strong>, then <strong>Add</strong>. Tectum appears in your Dock and Launchpad.</li>
      </ol>
    );
  }
  if (p === 'desktop-firefox') {
    return (
      <p className="text-[15px] leading-6 text-ink">
        Firefox can't add websites as apps. Open <strong>www.tectum.co.in</strong> in <strong>Chrome</strong> or <strong>Edge</strong> and click Install app there - or drag the padlock at the left of the address bar onto your desktop to make a shortcut.
      </p>
    );
  }
  return (
    <ol className="list-decimal space-y-2.5 pl-5 text-[15px] leading-6 text-ink">
      <li>
        Click the install icon <Download className={STEP_ICON} aria-hidden="true" /> at the right end of the address bar - or open the browser menu <MoreVertical className={STEP_ICON} aria-label="menu" />.
      </li>
      <li>
        {p === 'desktop-edge' ? (
          <>Choose <strong>Apps</strong> → <strong>Install this site as an app</strong>, then <strong>Install</strong>.</>
        ) : (
          <>Choose <strong>Cast, save and share</strong> → <strong>Install page as app</strong> (or <strong>Create shortcut</strong>), then <strong>Install</strong>.</>
        )}
      </li>
      <li>Tectum gets its own icon on your desktop / taskbar.</li>
    </ol>
  );
}

/**
 * "Install app shortcut": the browser's own install dialog where there is one; otherwise the steps
 * for this browser. Returns start() and the steps modal to render.
 */
function useInstallFlow({ onStepsClosed } = {}) {
  const save = useSaveShortcut();
  const [stepsOpen, setStepsOpen] = useState(false);
  const start = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      save('installed');
      toast('Tectum is on your home screen');
    } else if (outcome === 'unavailable') setStepsOpen(true);
    return outcome;
  };
  const close = () => {
    setStepsOpen(false);
    onStepsClosed?.();
  };
  const modal = (
    <Modal
      open={stepsOpen}
      onClose={close}
      title={isPhoneOrTablet() ? 'Add Tectum to your home screen' : 'Add Tectum to your computer'}
      footer={
        <div className="flex justify-end">
          <button className="btn-primary" onClick={close}>Got it</button>
        </div>
      }
    >
      <div className="space-y-3 px-5 py-4">
        <Steps />
        <p className="muted text-[13px]">Then open Tectum from the new icon once - that's how we know it's added.</p>
      </div>
    </Modal>
  );
  return { start, modal };
}

/**
 * Home, top right: asks once (first time on Home, not opened from the icon already). Tap it to
 * see "Install app shortcut" and "Do it later"; later puts a red reminder on the member's profile.
 */
export function AppShortcutPopup() {
  const me = useAuthStore((s) => s.user);
  const save = useSaveShortcut();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  // closing the steps without the icon detected yet: the profile reminder takes over
  const flow = useInstallFlow({ onStepsClosed: () => save('later') });
  const show = me && !me.appShortcut && me.onboardedAt && !isStandalone() && !hidden;
  if (!show) return flow.modal;

  const later = () => {
    setHidden(true);
    save('later');
    toast("No problem - you'll find a reminder on your profile");
  };
  const install = async () => {
    setHidden(true);
    if ((await flow.start()) === 'dismissed') setHidden(false); // said no to the browser's dialog: still here
  };

  return (
    <>
      <div
        role="dialog"
        aria-label="Add Tectum to your home screen"
        className="fixed right-3 top-[calc(4rem+env(safe-area-inset-top))] z-[60] w-[min(340px,calc(100vw-24px))] rounded-ds-lg border border-ds-line bg-[var(--ds-surface)] font-ui text-ds-fg shadow-lg md:right-5 md:top-5"
      >
        {!open ? (
          <div className="flex items-center">
            <button type="button" onClick={() => setOpen(true)} className="ds-focus flex min-w-0 flex-1 items-center gap-3 rounded-ds-lg px-3 py-3 text-left" aria-expanded="false">
              <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px]" />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-5">Add Tectum to your {isPhoneOrTablet() ? 'home screen' : 'computer'}</span>
                <span className="block text-[13px] leading-5 text-ds-fg-3">Open it in one tap. Tap here</span>
              </span>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-ds-fg-3" />
            </button>
            <button type="button" onClick={later} className="btn-ghost mr-1 min-h-10 min-w-10 p-2" aria-label="Do it later">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center gap-3">
              <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-[12px]" />
              <p className="text-[16px] font-semibold leading-5">Add the Tectum shortcut</p>
            </div>
            <p className="mt-2 text-[14px] leading-5 text-ds-fg-2">
              Get the Tectum icon on your {isPhoneOrTablet() ? 'phone or tablet' : 'desktop'} and open it in one tap - no link to find, no Google search.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" className="btn-primary w-full" onClick={install} autoFocus>
                Install app shortcut
              </button>
              <button type="button" className="btn-secondary w-full" onClick={later}>
                Do it later
              </button>
            </div>
          </div>
        )}
      </div>
      {flow.modal}
    </>
  );
}

/** Own profile, at the top, in red: stays until the shortcut is added (or opened from the icon). */
export function AppShortcutReminder() {
  const me = useAuthStore((s) => s.user);
  const flow = useInstallFlow();
  if (me?.appShortcut !== 'later' || isStandalone()) return flow.modal;
  return (
    <>
      <div role="alert" className="flex flex-wrap items-center gap-3 border-b-2 border-danger bg-danger-soft px-4 py-3 font-ui">
        <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
        <p className="min-w-0 flex-1 text-[14px] leading-5 text-danger">
          <strong className="font-semibold">Tectum isn't on your {isPhoneOrTablet() ? 'home screen' : 'computer'} yet.</strong> Add the shortcut to open it in one tap.
        </p>
        <button type="button" className="shrink-0 rounded-full bg-danger px-4 py-2 text-[14px] font-semibold text-white transition hover:opacity-90" onClick={flow.start}>
          Add shortcut
        </button>
      </div>
      {flow.modal}
    </>
  );
}
