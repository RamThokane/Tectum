// Study-streak analytics, kept pure so the edge cases are testable (see streakMath.test.js).

/** Whole days from day `a` to day `b` ("YYYY-MM-DD" strings). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

/** A date as "YYYY-MM-DD" in the given time zone (the member's own calendar day). */
export function dayInZone(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

/**
 * How many of the last days were active. The window is 30 days, or fewer for a newer account:
 * min(30, days since joining, counting today), so a 3-day-old account can reach 100%.
 */
export function consistency(activeDays, joinedDay, today, maxWindow = 30) {
  const sinceJoin = joinedDay ? daysBetween(joinedDay, today) + 1 : maxWindow;
  const window = Math.max(1, Math.min(maxWindow, sinceJoin));
  const active = Math.min(activeDays, window);
  return { window, active, pct: Math.round((active / window) * 100) };
}

/**
 * This week vs last week. Nothing last week can't be a percentage change: it's "New" when there
 * is activity this week, and "—" when both weeks are empty.
 */
export function weekChange(thisWeek, lastWeek) {
  if (!lastWeek) return thisWeek ? { kind: 'new', label: 'New', direction: 1 } : { kind: 'none', label: '—', direction: 0 };
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  return { kind: 'pct', pct, label: `${pct > 0 ? '+' : ''}${pct}%`, direction: Math.sign(pct) };
}
