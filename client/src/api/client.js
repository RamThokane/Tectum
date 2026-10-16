import axios from 'axios';
import { useAuthStore } from '../store/auth';

export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '');

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true, // send the httpOnly auth cookie
});

// The cookie is the primary credential; the in-memory token (never persisted) is a fallback
// for setups where third-party cookies are blocked.
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const PUBLIC_PATHS = ['/', '/login', '/signup'];

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const data = error.response?.data;

    // Prefer the most specific server message (first validation issue, then the summary).
    error.message = data?.details?.[0]?.message || data?.message || error.message;

    if (status === 401 && !url.startsWith('/auth/')) {
      useAuthStore.getState().clear();
      const here = window.location.pathname;
      if (!PUBLIC_PATHS.includes(here)) {
        window.location.assign(`/login?next=${encodeURIComponent(here + window.location.search)}`);
      }
    }
    return Promise.reject(error);
  }
);

/** Local-disk uploads are served as relative paths; Cloudinary URLs are absolute. */
export const assetUrl = (path) => (!path ? '' : path.startsWith('/') ? `${API_ORIGIN}${path}` : path);
