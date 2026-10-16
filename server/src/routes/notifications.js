import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { protect } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { paginationSchema } from '../validators.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const router = Router();
router.use(protect);

router.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.validatedQuery;
    const filter = { recipient: req.user._id };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('sourceUser', 'name role verificationStatus profilePicture')
        .populate('post', 'type title content caseStudy.chiefComplaint notesFile.fileName'),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);
    res.json({ notifications, unreadCount, page, hasMore: page * limit < total, nextPage: page * limit < total ? page + 1 : null });
  })
);

/** GET /notifications/unread-count -> { unreadCount } (the bell badge; one cheap count). */
router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    res.json({ unreadCount: await Notification.countDocuments({ recipient: req.user._id, isRead: false }) });
  })
);

router.put(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read' });
  })
);

router.put(
  '/:id/read',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { returnDocument: 'after' }
    );
    if (!n) throw ApiError.notFound('Notification not found');
    res.json({ notification: n });
  })
);

export default router;
