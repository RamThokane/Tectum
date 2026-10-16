/**
 * @handles: 3-30 characters, lowercase letters, numbers, dots and underscores, starting and
 * ending with a letter or number. Same rule as the client (client/src/lib/username.js).
 */
export const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;
export const USERNAME_RULE = 'Use 3-30 lowercase letters, numbers, dots or underscores (start and end with a letter or number)';

// Handles that would look official or clash with app pages.
const RESERVED = new Set(['admin', 'administrator', 'tectum', 'support', 'help', 'official', 'moderator', 'mod', 'staff', 'team', 'root', 'system', 'me', 'settings', 'null', 'undefined']);

export const isReservedUsername = (u) => RESERVED.has(u) || u.startsWith('tectum');

/** "Dr. Ananya Iyer" -> "ananya.iyer" (titles dropped, accents removed, at most 22 characters). */
export function usernameBase(name = '') {
  const plain = String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 22)
    .replace(/\.+$/, '');
  return plain.length >= 3 && !isReservedUsername(plain) ? plain : `member${plain ? `.${plain}` : ''}`.slice(0, 22);
}

/** A free handle for this name: the plain one if nobody has it, else with a few digits added. */
export async function uniqueUsername(UserModel, name) {
  const base = usernameBase(name);
  for (let i = 0; i < 25; i += 1) {
    const candidate = i === 0 ? base : `${base}${Math.floor(10 + Math.random() * (i < 10 ? 90 : 9990))}`;
    if (!(await UserModel.exists({ username: candidate }))) return candidate;
  }
  return `${base}${Date.now().toString(36)}`.slice(0, 30);
}

/** Gives every older account a handle (runs at server start; does nothing once all have one). */
export async function backfillUsernames(UserModel) {
  const missing = await UserModel.find({ $or: [{ username: { $exists: false } }, { username: '' }] }).select('name username');
  for (const u of missing) {
    u.username = await uniqueUsername(UserModel, u.name);
    await u.save({ validateModifiedOnly: true });
  }
  if (missing.length) console.log(`[users] gave ${missing.length} account(s) an @handle`);
}
