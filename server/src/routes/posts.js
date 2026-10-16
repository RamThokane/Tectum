import { Router } from 'express';
import {
  createPost,
  getFeed,
  getPost,
  updatePost,
  deletePost,
  toggleLike,
  toggleRepost,
  toggleBookmark,
  reportPost,
  recordDownload,
  votePoll,
  revealAnswer,
  recordViewsBatch,
  recordPostView,
  markNotInterested,
  undoNotInterested,
  saveNotebookNote,
  getTrending,
  suggestTags,
  getCaseOfTheDay,
  setCaseOfTheDay,
} from '../controllers/postController.js';
import { addComment, listComments, deleteComment, toggleCommentLike, toggleCommentRepost, toggleCommentBookmark, reportComment } from '../controllers/commentController.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { uploadPostFiles } from '../middleware/upload.js';
import {
  createPostSchema,
  updatePostSchema,
  feedQuerySchema,
  commentSchema,
  paginationSchema,
  reportSchema,
  notebookNoteSchema,
} from '../validators.js';

const router = Router();

router
  .route('/')
  .get(protect, validate(feedQuerySchema, 'query'), getFeed)
  .post(protect, uploadPostFiles, validate(createPostSchema), createPost);

router.get('/trending', protect, getTrending);
router.route('/case-of-the-day').get(protect, getCaseOfTheDay).put(protect, requireAdmin, setCaseOfTheDay);
router.get('/tags', protect, suggestTags);
// Views: the browser reports cards it actually showed (each viewer counts once per post per day).
router.post('/views', protect, recordViewsBatch);

router.use('/:id', validateObjectId('id'));
router
  .route('/:id')
  .get(protect, getPost)
  .put(protect, validate(updatePostSchema), updatePost)
  .delete(protect, deletePost);

router.post('/:id/like', protect, toggleLike);
router.post('/:id/repost', protect, toggleRepost);
router.post('/:id/bookmark', protect, toggleBookmark);
router.post('/:id/download', protect, recordDownload);
router.post('/:id/vote', protect, votePoll); // votes are final: there is no route to remove or change one
router.post('/:id/reveal', protect, revealAnswer);
router.post('/:id/solve', protect, revealAnswer); // old name, for browsers still on the previous version
router.post('/:id/view', protect, recordPostView);
router.post('/:id/not-interested', protect, markNotInterested);
router.delete('/:id/not-interested', protect, undoNotInterested);
router.put('/:id/note', protect, validate(notebookNoteSchema), saveNotebookNote);
router.post('/:id/report', protect, validate(reportSchema), reportPost);
// ---- comments: /api/posts/:postId/comments ----
const comments = Router({ mergeParams: true });
comments
  .route('/')
  .get(protect, validate(paginationSchema, 'query'), listComments)
  .post(protect, validate(commentSchema), addComment);
comments.delete('/:commentId', protect, validateObjectId('commentId'), deleteComment);
comments.post('/:commentId/like', protect, validateObjectId('commentId'), toggleCommentLike);
comments.post('/:commentId/repost', protect, validateObjectId('commentId'), toggleCommentRepost);
comments.post('/:commentId/bookmark', protect, validateObjectId('commentId'), toggleCommentBookmark);
comments.post('/:commentId/report', protect, validateObjectId('commentId'), validate(reportSchema), reportComment);

router.use('/:postId/comments', validateObjectId('postId'), comments);

export default router;
