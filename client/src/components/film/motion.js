// Small timing helpers for the film. Every frame is a pure function of the time t (seconds).

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** Smooth start and stop (cubic). */
export const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** Quick start, gentle landing. */
export const easeOut = (x) => 1 - (1 - x) ** 3;
/** 0 -> 1 over [start, start + dur], eased out. */
export const prog = (t, start, dur = 0.8) => easeOut(clamp01((t - start) / dur));
/** 1 while inside [a, b], easing in at a and out before b. */
export const span = (t, a, b, fadeIn = 0.6, fadeOut = 0.6) => Math.min(prog(t, a, fadeIn), 1 - ease(clamp01((t - (b - fadeOut)) / fadeOut)));

/**
 * Camera position at t from keys [[time, x, y, scale], ...], eased between neighbours.
 * `cut` (reduced motion) jumps halfway through each move instead of gliding.
 */
export function camera(t, keys, cut = false) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i += 1) {
    const [t1, ...b] = keys[i];
    const [t0, ...a] = keys[i - 1];
    if (t <= t1) {
      const x = (t - t0) / (t1 - t0 || 1);
      const p = cut ? (x < 0.5 ? 0 : 1) : ease(x);
      return a.map((v, j) => v + (b[j] - v) * p);
    }
  }
  return keys[keys.length - 1].slice(1);
}

/** Fade and rise into place (no rise with reduced motion). */
export const rise = (p, still, dist = 14) => ({ opacity: p, transform: still ? undefined : `translateY(${(1 - p) * dist}px)` });
