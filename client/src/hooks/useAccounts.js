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

/** Admins only: step into a demo account (scripts/seed-demo) to edit it with the normal screens. */
export function useUseDemoAccount() {
  const apply = useApplySession();
  return useMutation({
    mutationFn: (userId) => api.post(`/admin/demo/${userId}/use`).then((r) => r.data),
    onSuccess: ({ user, token }) => apply(user, token, `Now using the demo account ${user.name}`),
    onError: (e) => toast(e.message, 'error'),
  });
}

/**
 * Leaves a demo account: switches to the first saved admin account in this browser and forgets
 * the demo session, so demo accounts don't pile up in the account switcher.
 */
export function useLeaveDemoAccount() {
  const apply = useApplySession();
  const me = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.get('/auth/accounts');
      const admin = data.accounts.find((a) => a.isAdmin && !a.isDemo);
      if (!admin) throw new Error('Your admin account is not saved in this browser. Log out and log in to it again.');
      const switched = (await api.post('/auth/switch', { userId: admin._id })).data;
      await api.delete(`/auth/accounts/${me._id}`).catch(() => {});
      return switched;
    },
    onSuccess: ({ user, token }) => apply(user, token, `Back to ${user.name}`),
    onError: (e) => toast(e.message, 'error'),
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
