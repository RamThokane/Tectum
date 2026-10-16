import mongoose from 'mongoose';

/**
 * Study actions that aren't stored anywhere else, for the study streak / progress card:
 * solving a case (first vote or reveal) and revising flashcards. Posts and answers are counted
 * straight from the posts and comments collections. Kept for about a year.
 */
const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['solve', 'review'], required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  count: { type: Number, default: 1, min: 1 },
  at: { type: Date, default: Date.now },
});

activitySchema.index({ user: 1, at: -1 });
activitySchema.index({ at: 1 }, { expireAfterSeconds: 400 * 86400 });

export const Activity = mongoose.model('Activity', activitySchema);

/** Log a study action (never fails the request that triggered it). */
export const logActivity = (user, type, { post, count = 1 } = {}) =>
  Activity.create({ user, type, post, count }).catch(() => {});
