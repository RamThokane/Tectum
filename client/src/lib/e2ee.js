/**
 * End-to-end encryption for direct messages, using the browser's Web Crypto API only.
 *
 * - Each member has an ECDH P-256 key pair. The public key is shared via the server.
 * - The private key never leaves the browser unencrypted: it is backed up to the server wrapped
 *   with AES-GCM under a key derived from the member's chat passphrase (PBKDF2-SHA256).
 * - Two members derive the same conversation key: ECDH(my private, their public) -> HKDF-SHA256
 *   -> AES-GCM-256. Every message gets a fresh random 96-bit IV.
 * - Once unlocked, the private key is cached in IndexedDB as a NON-extractable CryptoKey, so the
 *   passphrase isn't needed again on this device (and script can't read the raw key out).
 *
 * Limits (said plainly in the UI): no forward secrecy (a stolen private key + stored ciphertext
 * reveals old messages), and resetting your key makes older messages unreadable.
 */

const subtle = globalThis.crypto?.subtle;
export const e2eeSupported = Boolean(subtle && globalThis.indexedDB);

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
export const PBKDF2_ITERATIONS = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const random = (n) => crypto.getRandomValues(new Uint8Array(n));

/** Short, stable id for a public key (also the basis of the "safety number"). */
async function keyIdOf(publicJwk) {
  const canonical = JSON.stringify({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x, y: publicJwk.y });
  return toB64(await subtle.digest('SHA-256', enc.encode(canonical))).slice(0, 32);
}

async function passphraseKey(passphrase, salt, iterations) {
  const base = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * New key pair for a member. Returns the bundle to upload (public key + passphrase-wrapped
 * private key) and the ready-to-use private CryptoKey.
 */
export async function createKeyBundle(passphrase) {
  const pair = await subtle.generateKey(ECDH, true, ['deriveKey', 'deriveBits']);
  const publicJwk = await subtle.exportKey('jwk', pair.publicKey);
  const pkcs8 = await subtle.exportKey('pkcs8', pair.privateKey);
  const salt = random(16);
  const iv = random(12);
  const wrapKey = await passphraseKey(passphrase, salt, PBKDF2_ITERATIONS);
  const encPrivateKey = await subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, pkcs8);
  const privateKey = await subtle.importKey('pkcs8', pkcs8, ECDH, false, ['deriveKey', 'deriveBits']);
  return {
    bundle: {
      keyId: await keyIdOf(publicJwk),
      publicKey: JSON.stringify(publicJwk),
      encPrivateKey: toB64(encPrivateKey),
      salt: toB64(salt),
      iv: toB64(iv),
      iterations: PBKDF2_ITERATIONS,
    },
    privateKey,
  };
}

/** Decrypts the private-key backup with the passphrase. Throws if the passphrase is wrong. */
export async function unlockKeyBundle(bundle, passphrase) {
  const wrapKey = await passphraseKey(passphrase, fromB64(bundle.salt), bundle.iterations);
  let pkcs8;
  try {
    pkcs8 = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(bundle.iv) }, wrapKey, fromB64(bundle.encPrivateKey));
  } catch {
    throw new Error('That passphrase is not correct');
  }
  return subtle.importKey('pkcs8', pkcs8, ECDH, false, ['deriveKey', 'deriveBits']);
}

// ---------------- conversation keys + messages ----------------

const convKeyCache = new Map(); // `${myKeyId}|${theirKeyId}` -> AES key

/** The AES key two members share, derived from my private key and their public key. */
export async function conversationKey(myPrivateKey, myKeyId, theirPublicKeyJson, theirKeyId) {
  const cacheKey = `${myKeyId}|${theirKeyId}`;
  if (convKeyCache.has(cacheKey)) return convKeyCache.get(cacheKey);
  const theirs = await subtle.importKey('jwk', JSON.parse(theirPublicKeyJson), ECDH, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: theirs }, myPrivateKey, 256);
  const hkdfBase = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  // Both sides must use the same info string, so the two key ids go in sorted order.
  const info = enc.encode(`tectum-dm-v1|${[myKeyId, theirKeyId].sort().join('|')}`);
  const key = await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info }, hkdfBase, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  convKeyCache.set(cacheKey, key);
  return key;
}

export async function encryptText(key, text) {
  const iv = random(12);
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { ciphertext: toB64(ciphertext), iv: toB64(iv) };
}

export async function decryptText(key, ciphertext, iv) {
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ciphertext));
  return dec.decode(plain);
}

/** "Safety number": 12 groups of 5 digits both people see identically; if they match, no one swapped keys. */
export async function safetyNumber(keyIdA, keyIdB) {
  const digest = new Uint8Array(await subtle.digest('SHA-256', enc.encode([keyIdA, keyIdB].sort().join('|'))));
  const groups = [];
  for (let i = 0; i < 12; i++) {
    const n = ((digest[i * 2] << 8) | digest[i * 2 + 1]) % 100000;
    groups.push(String(n).padStart(5, '0'));
  }
  return groups;
}

// ---------------- device cache (IndexedDB) ----------------

const DB = 'tectum-e2ee';
const STORE = 'keys';
const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
const tx = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
};

/** Remembers the unlocked (non-extractable) private key on this device. */
export const cachePrivateKey = (userId, keyId, privateKey) =>
  tx('readwrite', (s) => s.put({ keyId, privateKey }, userId)).catch(() => {});

/** The cached private key for this member, if it still matches their current key id. */
export async function cachedPrivateKey(userId, keyId) {
  try {
    const row = await tx('readonly', (s) => s.get(userId));
    return row?.keyId === keyId ? row.privateKey : null;
  } catch {
    return null;
  }
}

export const forgetPrivateKey = (userId) => tx('readwrite', (s) => s.delete(userId)).catch(() => {});
