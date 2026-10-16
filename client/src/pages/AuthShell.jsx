import { ChevronLeft } from 'lucide-react';
import { Logo, ThemeToggle } from '../components/Navbar';
import { useGoBack } from '../hooks/useGoBack';

/**
 * Log in / sign up / password pages: a glass panel floating over the app's drifting backdrop.
 * "‹" goes back (or to the landing page when the page was opened directly).
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  const goBack = useGoBack('/');
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="ds-backdrop" aria-hidden="true" />
      <header className="flex items-center justify-between py-4 pl-1 pr-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="flex items-center">
          <button type="button" onClick={goBack} className="ds-focus ds-press flex size-11 shrink-0 items-center justify-center rounded-full text-ds-fg hover:bg-ds-surface-2" aria-label="Back">
            <ChevronLeft className="size-7" strokeWidth={1.75} />
          </button>
          <Logo />
        </div>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          <div className="ds-glass-strong ds-rise rounded-[20px] p-6 sm:p-8">
            <h1 className="font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em]">{title}</h1>
            {subtitle && <p className="muted mt-1 text-[15px]">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <p className="muted mt-6 text-center text-[13px]">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[12px] font-medium text-danger">{children}</p>;
}
