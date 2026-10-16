import { Router } from 'express';
import {
  signup,
  sendEmailCode,
  verifyEmailCode,
  login,
  logout,
  logoutAll,
  me,
  listAccounts,
  switchAccount,
  forgetAccount,
  forgotPassword,
  resetPassword,
  googleAuth,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  signupSchema,
  sendEmailCodeSchema,
  verifyEmailCodeSchema,
  loginSchema,
  switchAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleAuthSchema,
} from '../validators.js';

const router = Router();

router.post('/signup/send-code', authLimiter, validate(sendEmailCodeSchema), sendEmailCode);
router.post('/signup/verify-code', authLimiter, validate(verifyEmailCodeSchema), verifyEmailCode);
router.post('/signup', authLimiter, validate(signupSchema), signup);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/google', authLimiter, validate(googleAuthSchema), googleAuth);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/logout', logout);
router.post('/logout-all', logoutAll);
router.get('/me', protect, me);

// Multiple accounts on one browser
router.get('/accounts', listAccounts);
router.post('/switch', validate(switchAccountSchema), switchAccount);
router.delete('/accounts/:userId', validateObjectId('userId'), forgetAccount);

export default router;
