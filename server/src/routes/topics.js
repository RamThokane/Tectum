import { Router } from 'express';
import { listTopics, getTopic } from '../controllers/topicController.js';

const router = Router();

router.get('/', listTopics);
router.get('/:slug', getTopic);

export default router;
