import { Logo, ThemeToggle } from '../components/Navbar';

/** Log in / sign up / password pages: a glass panel floating over the app's drifting backdrop. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="ds-backdrop" aria-hidden="true" />
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
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
