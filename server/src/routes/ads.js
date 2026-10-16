import { Router } from 'express';
import { Ad, AdSettings, getAdSettings } from '../models/Ad.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { uploadAdImage, assertFile, MAX_IMAGE_BYTES } from '../middleware/upload.js';
import { adSchema, adUpdateSchema } from '../validators.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { saveFile, deleteFile } from '../utils/storage.js';
import { hasBlueTick } from '../utils/premium.js';

const router = Router();
router.use(protect);

const PUBLIC_FIELDS = 'advertiser title body imageUrl linkUrl cta placement';

/** Ads that may be shown right now for a placement. */
const liveFilter = (placement) => {
  const now = new Date();
  return {
    active: true,
    placement: { $in: [placement, 'both'] },
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  };
};

/**
 * GET /api/ads?placement=rail|feed&count=1..5 - random live ads. Each one returned counts as a view.
 * Nothing here depends on who is asking: every member gets the same pool (no targeting).
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Blue tick members get Tectum ad-free (a perk of the upgrade).
    if (hasBlueTick(req.user)) return res.json({ ads: [] });
    const placement = req.query.placement === 'feed' ? 'feed' : 'rail';
    const count = Math.min(Math.max(parseInt(req.query.count, 10) || 1, 1), 5);
    const ads = await Ad.aggregate([{ $match: liveFilter(placement) }, { $sample: { size: count } }, { $project: Object.fromEntries(PUBLIC_FIELDS.split(' ').map((f) => [f, 1])) }]);
    if (ads.length) await Ad.updateMany({ _id: { $in: ads.map((a) => a._id) } }, { $inc: { impressions: 1 } });
    res.json({ ads });
  })
);

/** GET /api/ads/settings - how often feed ads appear ({ feedEvery }: after every N posts, 0 = off). */
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    res.json(await getAdSettings());
  })
);

/** POST /api/ads/:id/click - counts a click (the browser opens the link itself). */
router.post(
  '/:id/click',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    await Ad.updateOne({ _id: req.params.id }, { $inc: { clicks: 1 } });
    res.json({ ok: true });
  })
);

// ---------------- admin: create / edit / pause / delete ----------------
const admin = Router();
admin.use(requireAdmin);

admin.get(
  '/',
  asyncHandler(async (_req, res) => {
    const ads = await Ad.find().sort({ createdAt: -1 }).limit(200);
    res.json({ ads });
  })
);

/** PUT /api/ads/manage/settings { feedEvery } - show a feed ad after every N posts (0 = no feed ads). */
admin.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const feedEvery = Number(req.body?.feedEvery);
    if (!Number.isInteger(feedEvery) || feedEvery < 0 || feedEvery > 50) {
      throw ApiError.badRequest('Choose a whole number from 0 to 50');
    }
    await AdSettings.updateOne({ key: 'ads' }, { $set: { feedEvery, updatedBy: req.user._id } }, { upsert: true });
    res.json(await getAdSettings());
  })
);

admin.post(
  '/',
  uploadAdImage,
  validate(adSchema),
  asyncHandler(async (req, res) => {
    const doc = { ...req.body, createdBy: req.user._id };
    if (req.file) {
      assertFile(req.file, { maxBytes: MAX_IMAGE_BYTES, label: 'Ad image' });
      doc.imageUrl = (await saveFile(req.file, { folder: 'ads' })).url;
    }
    const ad = await Ad.create(doc);
    res.status(201).json({ ad });
  })
);

admin.patch(
  '/:id',
  validateObjectId('id'),
  uploadAdImage,
  validate(adUpdateSchema),
  asyncHandler(async (req, res) => {
    const ad = await Ad.findById(req.params.id);
    if (!ad) throw ApiError.notFound('Ad not found');
    Object.assign(ad, req.body);
    if (req.file) {
      assertFile(req.file, { maxBytes: MAX_IMAGE_BYTES, label: 'Ad image' });
      const old = ad.imageUrl;
      ad.imageUrl = (await saveFile(req.file, { folder: 'ads' })).url;
      await deleteFile(old);
    }
    await ad.save();
    res.json({ ad });
  })
);

admin.delete(
  '/:id',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) throw ApiError.notFound('Ad not found');
    await deleteFile(ad.imageUrl);
    res.json({ message: 'Ad deleted' });
  })
);

// /api/ads/manage/... must be registered before /:id/click can swallow it.
const combined = Router();
combined.use('/manage', protect, admin);
combined.use('/', router);
export default combined;
