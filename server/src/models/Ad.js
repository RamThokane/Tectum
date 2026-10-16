import mongoose from 'mongoose';

export const AD_PLACEMENTS = ['rail', 'feed', 'both'];

/**
 * A sponsored message shown to members: a card in the right-hand panel ("rail") and/or a
 * "Promoted" item between feed posts. Created and managed by admins only.
 * Ads are the same for everyone (not targeted); we only count views and clicks in total.
 */
const adSchema = new mongoose.Schema(
  {
    advertiser: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, trim: true, maxlength: 280, default: '' },
    imageUrl: { type: String, default: '' },
    linkUrl: { type: String, required: true, trim: true, maxlength: 500 },
    cta: { type: String, trim: true, maxlength: 24, default: 'Learn more' },
    placement: { type: String, enum: AD_PLACEMENTS, default: 'both' },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

adSchema.index({ active: 1, placement: 1 });

export const Ad = mongoose.model('Ad', adSchema);

export const DEFAULT_FEED_EVERY = 5;

/**
 * Site-wide ad settings (a single document, key 'ads'), changed by admins in Moderation > Ads.
 * feedEvery: a "Promoted" item after every N posts in the feed; 0 turns feed ads off.
 */
const adSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'ads', unique: true },
    feedEvery: { type: Number, min: 0, max: 50, default: DEFAULT_FEED_EVERY },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const AdSettings = mongoose.model('AdSettings', adSettingsSchema);

/** The current settings (defaults if an admin has never saved any). */
export async function getAdSettings() {
  const s = await AdSettings.findOne({ key: 'ads' }).lean();
  return { feedEvery: s?.feedEvery ?? DEFAULT_FEED_EVERY };
}
