import { Router } from 'express';
import { listWards, getWard, toggleWard, visitWard } from '../controllers/wardController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, listWards);
router.get('/:slug', protect, getWard);
router.post('/:slug/join', protect, toggleWard);
router.post('/:slug/visit', protect, visitWard);

export default router;
