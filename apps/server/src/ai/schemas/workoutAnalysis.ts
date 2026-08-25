import { z } from 'zod';

export const progressionRecommendationSchema = z.object({
  type: z.literal('progression_recommendation'),
  exercise: z.string(),
  action: z.enum(['increase_weight', 'maintain', 'deload', 'insufficient_data']),
  recommendedWeightKg: z.number(),
  targetSets: z.number().int(),
  targetReps: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  reasoning: z.string(),
});

export const workoutAnalysisSchema = z.object({
  summary: z.string(),
  recommendations: z.array(progressionRecommendationSchema),
  plateauedExercises: z.array(z.string()),
  overallTrend: z.enum(['improving', 'steady', 'declining', 'insufficient_data']),
});

export type WorkoutAnalysis = z.infer<typeof workoutAnalysisSchema>;
