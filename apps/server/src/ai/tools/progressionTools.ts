import { z } from 'zod';
import { analyticsService } from '../../services/analytics.service';
import { calculateProgress } from '../../services/progression';
import { defineTool } from './types';

const calculateProgressTool = defineTool({
  name: 'calculateProgress',
  description:
    'Compute a deterministic progressive-overload recommendation for one exercise from recent performance.',
  parameters: z.object({
    exerciseName: z.string().min(1),
    targetReps: z.number().int().min(1).max(30),
    muscleGroup: z.string().min(1),
  }),
  handler: async (userId, args) => {
    const recentSets = await analyticsService.getRecentPerformance(userId, args.exerciseName, 4);
    return calculateProgress(recentSets, args.targetReps, args.muscleGroup);
  },
});

export const progressionTools = [calculateProgressTool];
