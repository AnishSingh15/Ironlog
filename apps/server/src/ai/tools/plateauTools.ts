import { z } from 'zod';
import { analyticsService } from '../../services/analytics.service';
import { detectPlateau } from '../../services/plateau';
import { defineTool } from './types';

const detectPlateauTool = defineTool({
  name: 'detectPlateau',
  description: 'Deterministically check whether an exercise has plateaued over its recent sessions.',
  parameters: z.object({
    exerciseName: z.string().min(1),
    targetReps: z.number().int().min(1).max(30),
  }),
  handler: async (userId, args) => {
    const recentSets = await analyticsService.getRecentPerformance(userId, args.exerciseName, 6);
    return detectPlateau(recentSets, args.targetReps);
  },
});

export const plateauTools = [detectPlateauTool];
