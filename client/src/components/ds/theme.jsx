import { createContext, useContext } from 'react';
import { cn } from '../../lib/format';

// Which theme a subtree is drawn in. Pop-ups that render elsewhere in the page (portals: modals,
// toasts) read it so they keep the theme of the place they were opened from.
const DsThemeCtx = createContext(null);

const documentTheme = () => (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light');

export const useDsTheme = () => useContext(DsThemeCtx) ?? documentTheme();

/** Draws its children in the given theme ('light' | 'dark'): sets the token class and the context. */
export function DsTheme({ theme, className, children, ...props }) {
  return (
    <DsThemeCtx.Provider value={theme}>
      <div className={cn(`ds-${theme}`, className)} {...props}>
        {children}
      </div>
    </DsThemeCtx.Provider>
  );
}
