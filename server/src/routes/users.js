import { Router } from 'express';
import {
  getUser,
  updateUser,
  toggleFollow,
  submitVerification,
  getVerificationDocument,
  getUserPosts,
  getFollowers,
  getFollowing,
  getMyFollowingIds,
  getSuggestions,
  searchMentionable,
  toggleMute,
  toggleBlock,
  reportUser,
  updatePortfolio,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { listRepostedComments, listSavedComments } from '../controllers/commentController.js';
import { getActivity, recordReview, getStudyStats } from '../controllers/activityController.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { uploadProfileImages, uploadVerificationDoc } from '../middleware/upload.js';
import {
  updateProfileSchema,
  feedQuerySchema,
  changePasswordSchema,
  changeEmailSchema,
  confirmPasswordSchema,
  preferencesSchema,
  reportSchema,
  portfolioSchema,
  onboardingSchema,
  appShortcutSchema,
} from '../validators.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  changePassword,
  changeEmail,
  updatePreferences,
  logoutEverywhere,
  exportData,
  deactivateAccount,
  deleteAccount,
  completeOnboarding,
  updateAppShortcut,
} from '../controllers/accountController.js';

const router = Router();

router.get('/suggestions', protect, getSuggestions);
router.get('/mentionable', protect, searchMentionable);

// ---- account settings for the signed-in user (must come before /:id) ----
router.put('/me/password', protect, authLimiter, validate(changePasswordSchema), changePassword);
router.put('/me/email', protect, authLimiter, validate(changeEmailSchema), changeEmail);
router.put('/me/preferences', protect, validate(preferencesSchema), updatePreferences);
router.post('/me/logout-everywhere', protect, logoutEverywhere);
router.get('/me/export', protect, exportData);
router.post('/me/deactivate', protect, authLimiter, validate(confirmPasswordSchema), deactivateAccount);
router.delete('/me', protect, authLimiter, validate(confirmPasswordSchema), deleteAccount);
router.get('/me/saved-comments', protect, listSavedComments);
router.get('/me/following-ids', protect, getMyFollowingIds);
router.put('/me/portfolio', protect, validate(portfolioSchema), updatePortfolio);
router.get('/me/activity', protect, getActivity);
router.post('/me/onboarding', protect, validate(onboardingSchema), completeOnboarding);
router.put('/me/app-shortcut', protect, validate(appShortcutSchema), updateAppShortcut);
router.post('/me/activity/review', protect, recordReview);

router.use('/:id', validateObjectId('id'));
router
  .route('/:id')
  .get(protect, getUser)
  .put(protect, uploadProfileImages, validate(updateProfileSchema), updateUser);

router.post('/:id/follow', protect, toggleFollow);
router.post('/:id/mute', protect, toggleMute);
router.post('/:id/block', protect, toggleBlock);
router.post('/:id/report', protect, validate(reportSchema), reportUser);
router.post('/:id/verify', protect, uploadVerificationDoc, submitVerification);
router.get('/:id/verification-document', protect, getVerificationDocument);
router.get('/:id/posts', protect, validate(feedQuerySchema, 'query'), getUserPosts);
router.get('/:id/reposted-comments', protect, listRepostedComments);
router.get('/:id/study-stats', protect, getStudyStats);
router.get('/:id/followers', protect, getFollowers);
router.get('/:id/following', protect, getFollowing);

export default router;
