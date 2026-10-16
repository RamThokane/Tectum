import { create } from 'zustand';

/**
 * status: 'loading' (checking the session cookie) | 'authenticated' | 'guest'
 * The JWT lives in an httpOnly cookie; `token` is kept in memory only.
 */
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  status: 'loading',
  // loggedOut: the member chose to leave (log out, deactivate, delete) - they go to the landing
  // page, not the login page, even if a members-only page notices the logout first.
  loggedOut: false,
  setSession: (user, token) => set((s) => ({ user, token: token ?? s.token, status: 'authenticated', loggedOut: false })),
  setUser: (user) => set((s) => ({ user: { ...s.user, ...user } })),
  clear: () => set({ user: null, token: null, status: 'guest' }),
  signOut: () => set({ user: null, token: null, status: 'guest', loggedOut: true }),
}));
