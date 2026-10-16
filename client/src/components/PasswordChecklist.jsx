import { useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES, isStrongPassword } from '../lib/passwordRules';
import { cn } from '../lib/format';

/**
 * Remembers when the member has left the new-password box (or tried to save), so the full rules
 * can appear then. Clicking the box's show/hide eye doesn't count as leaving.
 */
export function usePasswordChecked() {
  const [checked, setChecked] = useState(false);
  const onBlur = (e) => {
    if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setChecked(true);
  };
  return [checked, onBlur, setChecked];
}

/**
 * The hint under a new-password box. Normally just "Minimum 8 characters"; the full rules (each
 * ticking green as it's met) only show once the password has been tried and doesn't meet them:
 * after leaving the box or trying to save (`checked`), or as soon as it reaches 8 characters.
 * Give the input `aria-describedby={id}` so screen readers read it too.
 */
export default function PasswordChecklist({ password = '', id, checked = false }) {
  const showRules = password && !isStrongPassword(password) && (checked || password.length >= 8);

  if (!showRules) {
    return (
      <p id={id} className="muted mt-2 text-[13px]">
        Minimum 8 characters
      </p>
    );
  }
  return (
    <div id={id} className="mt-2 text-[13px]">
      <p className="mb-1 text-danger">Your password needs:</p>
      <ul className="grid gap-1 sm:grid-cols-2" aria-label="Password must have">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.id} className={cn('flex items-center gap-1.5', ok ? 'text-success' : 'muted')}>
              {ok ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden="true" /> : <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              <span>
                {r.label}
                <span className="sr-only">{ok ? ' (done)' : ' (missing)'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
