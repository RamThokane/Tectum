import { User } from '../models/User.js';

// Almost every read hides deactivated accounts, and the list rarely changes, so it's kept in
// memory for a short while instead of costing a database round trip on every request.
// Deactivating / reactivating an account clears it at once (invalidateHiddenUsers).
const TTL_MS = 30_000;
let cached = null; // { ids, expires, pending }

/** IDs of deactivated accounts - their profiles, posts and comments are hidden everywhere. */
export async function getHiddenUserIds() {
  const now = Date.now();
  if (cached?.ids && cached.expires > now) return cached.ids;
  if (cached?.pending) return cached.pending; // one lookup shared by requests arriving together
  const pending = User.find({ deactivatedAt: { $ne: null } })
    .distinct('_id')
    .then((ids) => {
      cached = { ids, expires: Date.now() + TTL_MS };
      return ids;
    })
    .catch((err) => {
      cached = null;
      throw err;
    });
  cached = { ...cached, pending };
  return pending;
}

/** Call after an account is deactivated or reactivated. */
export const invalidateHiddenUsers = () => {
  cached = null;
};

/** Query fragment that keeps only active users. */
export const ACTIVE_USER = { deactivatedAt: null };
