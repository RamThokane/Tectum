import mongoose from 'mongoose';

/**
 * Spaced-repetition state for one saved post (a flashcard) of one member - the SM-2 algorithm
 * Anki is based on. A saved post with no card yet is a "new" card and is due straight away.
 */
const reviewCardSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    ease: { type: Number, default: 2.5 }, // SM-2 easiness factor, never below 1.3
    interval: { type: Number, default: 0 }, // days until the next review
    reps: { type: Number, default: 0 }, // successful reviews in a row
    lapses: { type: Number, default: 0 }, // times it was forgotten ("Again")
    due: { type: Date, default: Date.now, index: true },
    lastReviewedAt: { type: Date },
  },
  { timestamps: true }
);

reviewCardSchema.index({ user: 1, post: 1 }, { unique: true });
reviewCardSchema.index({ user: 1, due: 1 });

export const ReviewCard = mongoose.model('ReviewCard', reviewCardSchema);

export const GRADES = ['again', 'hard', 'good', 'easy'];
const QUALITY = { again: 1, hard: 3, good: 4, easy: 5 };
const DAY = 86400000;

/**
 * SM-2 scheduling. Returns the card's next state for a grade:
 *  again -> starts over, back in 10 minutes; hard -> shorter step; good -> normal step;
 *  easy -> longer step. Intervals: 1 day, then 3 (hard) / 6 days, then interval x ease.
 */
export function schedule(card, grade, now = new Date()) {
  const q = QUALITY[grade];
  let { ease = 2.5, interval = 0, reps = 0, lapses = 0 } = card ?? {};
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (q < 3) {
    return { ease, interval: 0, reps: 0, lapses: lapses + 1, due: new Date(now.getTime() + 10 * 60000), lastReviewedAt: now };
  }
  if (reps === 0) interval = grade === 'easy' ? 3 : 1;
  else if (reps === 1) interval = grade === 'hard' ? 3 : grade === 'easy' ? 8 : 6;
  else interval = Math.round(interval * (grade === 'hard' ? 1.2 : grade === 'easy' ? ease * 1.3 : ease));
  interval = Math.min(Math.max(interval, 1), 365);
  return { ease, interval, reps: reps + 1, lapses, due: new Date(now.getTime() + interval * DAY), lastReviewedAt: now };
}
