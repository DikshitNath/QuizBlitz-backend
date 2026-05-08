import { Router } from 'express';
import { createGame, getGame } from '../controllers/gameController.js';

const router = Router();
router.post('/create', createGame);
router.get('/:pin',    getGame);
export default router;