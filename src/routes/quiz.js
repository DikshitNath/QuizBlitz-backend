import { Router } from 'express';
import { generateFromTopic, generateFromPdfText, createManual } from '../controllers/quizController.js';

const router = Router();
router.post('/generate-topic', generateFromTopic);
router.post('/generate-pdf',   generateFromPdfText);
router.post('/manual',         createManual);
export default router;