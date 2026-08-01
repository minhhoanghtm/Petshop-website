import express from 'express';
import { createChatAI } from '../controllers/AIController.js';
const router = express.Router();

router.post('/chat', createChatAI);

export default router;