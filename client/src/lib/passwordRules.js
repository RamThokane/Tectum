// Account password rules (sign-up, reset, change / set password). The server enforces the same
// rules (server/src/validators.js, strongPassword), so a weak password is refused either way.
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'lower', label: 'One small letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'One capital letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number (0-9)', test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'One symbol, e.g. ! @ # $ %', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const PASSWORD_MAX = 72;

/** True when the password meets every rule. */
export const isStrongPassword = (p = '') => p.length <= PASSWORD_MAX && PASSWORD_RULES.every((r) => r.test(p));

/** The first rule it misses, as a sentence ("Add one capital letter (A-Z)"), or '' when it's fine. */
export function passwordProblem(p = '') {
  if (p.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters`;
  const miss = PASSWORD_RULES.find((r) => !r.test(p));
  if (!miss) return '';
  return miss.id === 'length' ? 'Use at least 8 characters' : `Add ${miss.label.charAt(0).toLowerCase()}${miss.label.slice(1)}`;
}
