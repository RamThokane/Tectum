import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { quizAnswersSchema, quizViolationSchema } from '../validators.js';
import { getAttempt, heartbeat, saveAnswers, reportViolation, submitAttempt, attemptResult, myAttempts } from '../controllers/attemptController.js';

/**
 * /api/attempts - a member's attempts at tests. Every request on a running attempt must carry its
 * session token in the X-Attempt-Session header (see attemptController).
 */
const router = Router();
router.use(protect);

const perMember = (limit, message) =>
  rateLimit({ windowMs: 60 * 1000, limit, keyGenerator: (req) => String(req.user._id), standardHeaders: 'draft-7', legacyHeaders: false, message: { message } });
const answerLimiter = perMember(240, 'Saving too fast - slow down a little.');
const violationLimiter = perMember(60, 'Too many requests.');

router.get('/mine', myAttempts);
router.use('/:attemptId', validateObjectId('attemptId'));
router.get('/:attemptId', getAttempt);
router.post('/:attemptId/heartbeat', heartbeat);
router.patch('/:attemptId/answer', answerLimiter, validate(quizAnswersSchema), saveAnswers);
router.post('/:attemptId/violation', violationLimiter, validate(quizViolationSchema), reportViolation);
router.post('/:attemptId/submit', submitAttempt);
router.get('/:attemptId/result', attemptResult);

export default router;
