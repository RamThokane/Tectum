import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { uploadQuestionImage } from '../middleware/upload.js';
import { quizSchema, joinQuizSchema, quizInviteSchema, quizImportSchema, reinstateSchema, hostApplicationSchema, quizRegistrationSchema, registrationDecisionSchema } from '../validators.js';
import {
  hostStatus,
  applyToHost,
  listHosts,
  hostTests,
  quizDetails,
  registerForQuiz,
  cancelRegistration,
  myRegistrations,
  listRegistrations,
  decideRegistrations,
} from '../controllers/quizHostController.js';
import {
  createQuiz,
  myQuizzes,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  duplicateQuiz,
  publishQuiz,
  regenerateCode,
  setJoinable,
  searchPeople,
  inviteToQuiz,
  importQuizQuestions,
  uploadQuestionImageHandler,
  quizResults,
  exportResults,
  attemptDetail,
  reinstateAttempt,
} from '../controllers/quizController.js';
import { joinQuiz, quizInfo, startAttempt, leaderboard } from '../controllers/attemptController.js';

/**
 * /api/quizzes - tests. Every route needs a signed-in member (guests can't see, join or take a
 * test). Organizer routes check ownership in the controller (404 for anyone else).
 */
const router = Router();
router.use(protect);

// Wrong codes: 10 per 15 minutes per member, so codes can't be guessed (right ones don't count).
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many wrong codes. Please wait 15 minutes and try again.' },
});

// Registering: 30 requests per hour per member is plenty for real use.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many registrations. Please try again later.' },
});

router.route('/').post(validate(quizSchema), createQuiz);
router.get('/mine', myQuizzes);
router.get('/people', searchPeople);
// conducting tests (applying), the Quizzes directory, a host's Tests tab, my registrations
router.get('/host/status', hostStatus);
router.post('/host/apply', validate(hostApplicationSchema), applyToHost);
router.get('/hosts', listHosts);
router.get('/by/:userId', hostTests);
router.get('/registrations/mine', myRegistrations);
router.post('/join', joinLimiter, validate(joinQuizSchema), joinQuiz);
router.post('/images', uploadQuestionImage, uploadQuestionImageHandler);

router.use('/:id', validateObjectId('id'));
router.route('/:id').get(getQuiz).put(validate(quizSchema), updateQuiz).delete(deleteQuiz);
router.post('/:id/duplicate', duplicateQuiz);
router.post('/:id/publish', publishQuiz);
router.post('/:id/regenerate-code', regenerateCode);
router.patch('/:id/joinable', setJoinable);
router.post('/:id/invite', validate(quizInviteSchema), inviteToQuiz);
router.post('/:id/import', validate(quizImportSchema), importQuizQuestions);
router.get('/:id/results', quizResults);
router.get('/:id/results/export', exportResults);
router.get('/:id/attempts/:attemptId', validateObjectId('attemptId'), attemptDetail);
router.post('/:id/attempts/:attemptId/reinstate', validateObjectId('attemptId'), validate(reinstateSchema), reinstateAttempt);

router.get('/:id/registrations', listRegistrations);
router.post('/:id/registrations', validate(registrationDecisionSchema), decideRegistrations);

// participant
router.get('/:id/details', quizDetails);
router.route('/:id/register').post(registerLimiter, validate(quizRegistrationSchema), registerForQuiz).delete(cancelRegistration);
router.get('/:id/info', quizInfo);
router.post('/:id/start', startAttempt);
router.get('/:id/leaderboard', leaderboard);

export default router;
