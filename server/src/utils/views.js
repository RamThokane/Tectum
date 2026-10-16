import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { ContentView } from '../models/ContentView.js';

export const MAX_VIEW_BATCH = 50;

/**
 * Counts views the browser reported (a card was at least half on screen for a second).
 * Each viewer counts once per item per UTC day; their own posts and comments never count.
 * Returns the ids whose view count went up.
 */
export async function recordViews(kind, ids, viewerId) {
  const Model = kind === 'post' ? Post : Comment;
  const unique = [...new Set(ids.map(String))].slice(0, MAX_VIEW_BATCH);
  if (!unique.length) return [];
  const targets = await Model.find({ _id: { $in: unique }, author: { $ne: viewerId } }).select('_id').lean();
  if (!targets.length) return [];

  const day = new Date().toISOString().slice(0, 10);
  let upserted;
  try {
    const result = await ContentView.bulkWrite(
      targets.map((t) => ({
        updateOne: { filter: { kind, target: t._id, viewer: viewerId, day }, update: { $setOnInsert: { createdAt: new Date() } }, upsert: true },
      })),
      { ordered: false }
    );
    upserted = result.upsertedIds ?? {};
  } catch (err) {
    // Two requests racing on the same row: the unique index rejects one; the other already counted.
    upserted = err.result?.upsertedIds ?? err.result?.result?.upsertedIds ?? {};
  }
  const counted = Object.keys(upserted).map((i) => targets[Number(i)]._id);
  if (counted.length) await Model.updateMany({ _id: { $in: counted } }, { $inc: { views: 1 } });
  return counted;
}
