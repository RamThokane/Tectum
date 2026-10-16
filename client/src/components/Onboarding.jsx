import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { Modal } from './ui';
import { LogoMark } from './Navbar';

/**
 * First-login greeting: "Welcome to Tectum, {name}" and a short hello - nothing to fill in.
 * Closing it (button, X, Escape or tapping outside) marks it as seen, so it shows only once.
 */
export default function Onboarding() {
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const first = (me?.name || '').replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '').split(/\s+/)[0];

  const done = useMutation({
    mutationFn: () => api.post('/users/me/onboarding', { skip: true }).then((r) => r.data.user),
    onSuccess: (user) => setUser(user),
  });
  // Hide at once; the server just records that it was seen.
  const close = () => {
    if (done.isPending) return;
    setUser({ ...me, onboardedAt: new Date().toISOString() });
    done.mutate();
  };

  return (
    <Modal open onClose={close} title="Welcome to Tectum" size="max-w-md" hideHeader>
      <div className="px-6 pb-7 pt-6 text-center">
        <LogoMark className="mx-auto h-16 w-16" />
        <h2 className="mt-4 font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em]">Welcome to Tectum{first ? `, ${first}` : ''}!</h2>
        <p className="muted mx-auto mt-2 max-w-sm text-[15px] leading-relaxed">
          We're so glad you're here. Happy learning, and enjoy your first case!
        </p>
        <button className="btn-primary mt-6 min-h-12 w-full" onClick={close} autoFocus>
          Get started
        </button>
      </div>
    </Modal>
  );
}
