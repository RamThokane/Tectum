import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { SupportTicket, SUPPORT_CATEGORIES } from '../models/SupportTicket.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/ApiError.js';

const router = Router();

// Keep the help form from being used to spam the moderators' inbox.
const ticketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'You have sent several requests recently. Please wait a little before sending another.' },
});

const ticketSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES),
  message: z.string().trim().min(10, 'Please describe the problem in a bit more detail').max(2000),
});

router.post(
  '/',
  protect,
  ticketLimiter,
  validate(ticketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.create({ user: req.user._id, ...req.body });
    res.status(201).json({ ticket, message: "Thanks! We've received your message and will get back to you soon." });
  })
);

/** The signed-in member's own requests, newest first. */
router.get(
  '/mine',
  protect,
  asyncHandler(async (req, res) => {
    const tickets = await SupportTicket.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ tickets });
  })
);

export default router;
