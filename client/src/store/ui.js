import { create } from 'zustand';

const THEME_KEY = 'tectum-theme';
const TEXT_KEY = 'tectum-text-size';
const POPUPS_KEY = 'tectum-popups';

export const TEXT_SIZES = { sm: '14px', md: '16px', lg: '18px' };

const read = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

const readTheme = () => {
  try {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
};

export const useUIStore = create((set, get) => ({
  // ---- composer ----
  // `quote` is what's being quoted (X's "Quote"): a post, or a comment when quoteKind is 'comment'.
  // `kind` pre-selects the post type: 'pearl' | 'question' | 'notes' | 'image' | 'discussion'.
  // `ward` pre-selects the Ward (specialty slug) it's posted in.
  composer: { open: false, tab: 'text', quote: null, quoteKind: 'post', kind: 'discussion', ward: null },
  openComposer: (tab = 'text', { quote = null, quoteKind = 'post', kind = 'discussion', ward = null } = {}) =>
    set({ composer: { open: true, tab: quote ? 'text' : tab, quote, quoteKind, kind, ward } }),
  closeComposer: () => set((s) => ({ composer: { ...s.composer, open: false } })),

  // ---- theme ----
  // `theme` is what's showing (dark | light); `themeChoice` is what was picked (dark | light | system).
  theme: readTheme(),
  themeChoice: read(THEME_KEY, 'system'),
  setTheme: (choice) => {
    const theme = choice === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : choice;
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    // keep the pre-paint background (set in public/theme.js) in step with the theme
    root.style.backgroundColor = theme === 'dark' ? '#0b0d12' : '#f6f7f9';
    root.style.colorScheme = theme;
    if (choice === 'system') {
      try {
        localStorage.removeItem(THEME_KEY); // no saved choice = follow the device (public/theme.js)
      } catch {
        /* storage unavailable */
      }
    } else {
      write(THEME_KEY, choice);
    }
    set({ theme, themeChoice: choice });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  // ---- text size (scales the whole UI via the root font size) ----
  textSize: read(TEXT_KEY, 'md'),
  setTextSize: (size) => {
    document.documentElement.style.fontSize = TEXT_SIZES[size] ?? TEXT_SIZES.md;
    write(TEXT_KEY, size);
    set({ textSize: size });
  },

  // ---- pop-up alerts for live notifications ----
  popups: read(POPUPS_KEY, 'on') !== 'off',
  setPopups: (on) => {
    write(POPUPS_KEY, on ? 'on' : 'off');
    set({ popups: on });
  },

  // ---- toasts ----
  toasts: [],
  toast: (message, tone = 'default') => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
}));

export const toast = (message, tone) => useUIStore.getState().toast(message, tone);
