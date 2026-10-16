import { useState } from 'react';
import { EyeOff, Eye } from 'lucide-react';
import { cn } from '../lib/format';
import { useAuthStore } from '../store/auth';

/** Blurs clinical imagery until the viewer opts in. */
export default function SensitiveContentOverlay({ sensitive, children, className }) {
  // Viewers can opt out of the blur in Settings -> Privacy & Data.
  const autoReveal = useAuthStore((s) => Boolean(s.user?.preferences?.showSensitive));
  const [revealed, setRevealed] = useState(autoReveal);
  if (!sensitive) return <div className={className}>{children}</div>;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className={cn('transition duration-300', !revealed && 'pointer-events-none scale-105 blur-2xl')} aria-hidden={!revealed} inert={!revealed}>
        {children}
      </div>
      {!revealed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink p-4 text-center text-white">
          <EyeOff className="h-6 w-6" />
          <p className="text-[13px] font-semibold">Sensitive clinical image</p>
          <p className="max-w-xs text-[12px] text-white/80">This may show graphic medical content.</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRevealed(true);
            }}
            className="btn mt-1 border border-white/60 bg-white/10 text-white backdrop-blur hover:bg-white/20"
          >
            Show image
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRevealed(false);
          }}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-medium text-white"
        >
          <Eye className="h-3.5 w-3.5" /> Hide
        </button>
      )}
    </div>
  );
}
