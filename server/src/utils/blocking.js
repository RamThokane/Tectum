import { User } from '../models/User.js';
import { ApiError } from './ApiError.js';

const has = (list = [], id) => list.some((x) => String(x) === String(id));

/** True if either member has blocked the other. */
export async function isBlockedEitherWay(aId, bId) {
  if (!aId || !bId) return false;
  return Boolean(
    await User.exists({
      $or: [
        { _id: aId, blocked: bId },
        { _id: bId, blocked: aId },
      ],
    })
  );
}

/** Throws 403 if the two members have a block between them. */
export async function assertNotBlocked(aId, bId, message = "You can't interact with this account") {
  if (await isBlockedEitherWay(aId, bId)) throw ApiError.forbidden(message);
}

/**
 * Authors a viewer shouldn't see in feeds: people they muted or blocked, and people who blocked
 * them. `includeMuted: false` for places where muting doesn't apply (e.g. the muted person's own profile).
 */
export async function hiddenAuthorsFor(viewer, { includeMuted = true } = {}) {
  if (!viewer) return [];
  // The signed-in user doc (req.user) already carries muted / blocked; only look them up if not.
  const own = Array.isArray(viewer.muted) && Array.isArray(viewer.blocked);
  const [me, blockedMe] = await Promise.all([own ? viewer : User.findById(viewer._id).select('muted blocked').lean(), whoBlocked(viewer._id)]);
  return [...(includeMuted ? me?.muted ?? [] : []), ...(me?.blocked ?? []), ...blockedMe];
}

// "Who has blocked this member" is needed by every feed but changes only when someone blocks or
// unblocks, so it's kept in memory per member for a minute. toggleBlock clears the blocked
// person's entry at once (invalidateBlockedBy), so a new block applies on the next request.
const BLOCKED_BY_TTL_MS = 60_000;
const blockedBy = new Map(); // viewerId -> { ids, expires }

async function whoBlocked(viewerId) {
  const key = String(viewerId);
  const hit = blockedBy.get(key);
  if (hit && hit.expires > Date.now()) return hit.ids;
  const ids = await User.find({ blocked: viewerId }).distinct('_id');
  if (blockedBy.size > 5000) blockedBy.clear(); // keep memory bounded
  blockedBy.set(key, { ids, expires: Date.now() + BLOCKED_BY_TTL_MS });
  return ids;
}

/** Call when `userId` is blocked or unblocked by someone. */
export const invalidateBlockedBy = (userId) => blockedBy.delete(String(userId));

export const relationFlags = (viewerDoc, target) => ({
  isMuted: has(viewerDoc?.muted, target._id),
  isBlocked: has(viewerDoc?.blocked, target._id),
  hasBlockedYou: Boolean(viewerDoc && has(target.blocked, viewerDoc._id)),
});
