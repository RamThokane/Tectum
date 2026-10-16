// Repeatable randomness: the same seed text always gives the same sequence, so re-running the
// seed makes the same people, authors and likes (that's what keeps it idempotent).

/** 32-bit hash of a string (FNV-1a). */
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A random generator with helpers, seeded from text. */
export function rng(seedText) {
  let a = hash(seedText);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    /** Float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Integer in [min, max] (both included). */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle: (list) => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** Picks one item; weightOf(item) >= 0. */
    weighted: (list, weightOf) => {
      const total = list.reduce((s, x) => s + weightOf(x), 0);
      let t = next() * total;
      for (const x of list) {
        t -= weightOf(x);
        if (t <= 0) return x;
      }
      return list[list.length - 1];
    },
    /** n distinct items, each drawn by weight. */
    weightedSample: (list, n, weightOf) => {
      const pool = [...list];
      const out = [];
      while (out.length < n && pool.length) {
        const x = r.weighted(pool, weightOf);
        out.push(x);
        pool.splice(pool.indexOf(x), 1);
      }
      return out;
    },
  };
  return r;
}
