import mongoose from 'mongoose';

/**
 * Site-wide choices made by admins, one document per key: 'caseOfTheDay' (the case shown as
 * Case of the Day on everyone's Home) and 'hideDemoInRankings' (on/off in `enabled`).
 */
const siteSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    enabled: { type: Boolean },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SiteSetting = mongoose.model('SiteSetting', siteSettingSchema);
