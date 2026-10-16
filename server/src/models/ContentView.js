import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

/**
 * One row per (post or comment, viewer, UTC day): a view only counts if inserting its row succeeds,
 * so each member adds at most one view per item per day. Rows expire after 2 days.
 */
const contentViewSchema = new mongoose.Schema({
  kind: { type: String, enum: ['post', 'comment'], required: true },
  target: { type: ObjectId, required: true },
  viewer: { type: ObjectId, ref: 'User', required: true },
  day: { type: String, required: true }, // YYYY-MM-DD (UTC)
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 48 },
});

contentViewSchema.index({ kind: 1, target: 1, viewer: 1, day: 1 }, { unique: true });

export const ContentView = mongoose.model('ContentView', contentViewSchema);
