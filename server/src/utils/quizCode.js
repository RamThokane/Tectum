import crypto from 'node:crypto';

/** No 0/O, 1/I/L: easy to read out and type. 31^8 ≈ 850 billion codes. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

export function newAccessCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

/** "ab cd-ef 23" -> "ABCDEF23" (what people paste or type in lowercase). */
export const normalizeCode = (raw) =>
  String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);

/**
 * Saves a fresh unique code on the quiz. The unique index is the real guarantee: on the (very
 * unlikely) clash, try again with another code.
 */
export async function assignAccessCode(Quiz, quizId) {
  for (let i = 0; i < 6; i++) {
    const code = newAccessCode();
    try {
      return await Quiz.findByIdAndUpdate(quizId, { accessCode: code }, { returnDocument: 'after' });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  throw new Error('Could not create a unique access code');
}

/** A per-attempt token: only the browser tab that started the attempt can use it. */
export const newSessionToken = () => crypto.randomBytes(24).toString('hex');

/** Deterministic shuffle (Fisher-Yates driven by a seed), so an attempt keeps its order. */
export function seededShuffle(items, seed) {
  const out = [...items];
  let h = crypto.createHash('sha256').update(String(seed)).digest();
  let i = out.length;
  let k = 0;
  while (i > 1) {
    if (k + 4 > h.length) {
      h = crypto.createHash('sha256').update(h).digest();
      k = 0;
    }
    const r = h.readUInt32BE(k) / 0x100000000;
    k += 4;
    const j = Math.floor(r * i);
    i -= 1;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
