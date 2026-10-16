import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';

/** Accounts remembered in this browser (the server keeps them in an httpOnly cookie). */
export function useSavedAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/auth/accounts').then((r) => r.data.accounts),
    staleTime: 60_000,
  });
}

/** Starts a fresh session for `user`: resets cached data so nothing from the old account leaks. */
function useApplySession() {
  const setSession = useAuthStore((s) => s.setSession);
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (user, token, message) => {
    qc.clear();
    setSession(user, token);
    navigate('/home', { replace: true });
    if (message) toast(message);
  };
}

export function useSwitchAccount() {
  const apply = useApplySession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => api.post('/auth/switch', { userId }).then((r) => r.data),
    onSuccess: ({ user, token }) => apply(user, token, `Switched to ${user.name}`),
    onError: (e) => {
      toast(e.message, 'error');
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/** Log out of the current account; if another account is saved, switch to it. */
export function useLogout() {
  const apply = useApplySession();
  const clear = useAuthStore((s) => s.signOut);
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    const res = await api.post('/auth/logout').catch(() => null);
    const next = res?.data?.switchedTo;
    if (next) {
      apply(next, res.data.token, `Logged out. Now using ${next.name}`);
      return;
    }
    clear();
    qc.clear();
    navigate('/', { replace: true }); // back to the landing page, like a first visit
  };
}

export function useLogoutAll() {
  const clear = useAuthStore((s) => s.signOut);
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await api.post('/auth/logout-all').catch(() => {});
    clear();
    qc.clear();
    navigate('/', { replace: true });
  };
}

export function useForgetAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => api.delete(`/auth/accounts/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      toast('Account removed from this browser');
    },
    onError: (e) => toast(e.message, 'error'),
  });
}
