import express from 'express';
import { createChatAI } from '../controllers/aiController.js';
const router = express.Router();

router.post('/chat', createChatAI);

export default router;