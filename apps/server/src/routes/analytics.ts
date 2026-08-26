import { Response, Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { analyticsService, MUSCLE_TIME_RANGES, type MuscleTimeRange } from '../services/analytics.service';

const router = Router();
router.use(authenticate);

function isMuscleTimeRange(value: unknown): value is MuscleTimeRange {
  return typeof value === 'string' && value in MUSCLE_TIME_RANGES;
}

// GET /api/v1/analytics/muscle-volume?range=7D|4W|8W|12W|6M
router.get('/muscle-volume', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const range: MuscleTimeRange = isMuscleTimeRange(req.query.range) ? req.query.range : '8W';

  try {
    const breakdown = await analyticsService.getMuscleVolumeBreakdown(userId, MUSCLE_TIME_RANGES[range]);
    return res.json({ success: true, data: breakdown });
  } catch (error) {
    console.error('Muscle volume analytics error:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

export default router;
