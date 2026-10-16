import { Post } from '../models/Post.js';
import { env } from '../config/env.js';

export const BOOST_MS = env.premiumBoostHours * 60 * 60 * 1000;

/** Blue tick = verified (free: an admin approving the document grants it; revoking removes it). */
export const hasBlueTick = (user) => user?.verificationStatus === 'verified';

/** Ranking time for a new post by this author. */
export const rankAtFor = (user, createdAt = new Date()) =>
  new Date(createdAt.getTime() + (hasBlueTick(user) ? BOOST_MS : 0));

/** Re-ranks all of a user's posts after their blue-tick status changes. */
export async function syncAuthorBoost(user) {
  const boost = hasBlueTick(user) ? BOOST_MS : 0;
  await Post.updateMany(
    { author: user._id },
    [{ $set: { rankAt: { $add: ['$createdAt', boost] } } }],
    { updatePipeline: true }
  );
}
