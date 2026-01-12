import express from 'express';
import { 
  joinQueue, 
  leaveQueue, 
  handleVote, 
  requestRematch,
  getLiveMatches 
} from '../controllers/duelController';

const router = express.Router();

router.post('/queue/join', joinQueue);
router.post('/queue/leave', leaveQueue);
router.post('/vote', handleVote);
router.post('/rematch', requestRematch);
router.get('/live', getLiveMatches);

export default router;