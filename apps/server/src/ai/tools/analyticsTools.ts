import { z } from 'zod';
import { analyticsService } from '../../services/analytics.service';
import { defineTool } from './types';

const getRecentWorkout = defineTool({
  name: 'getRecentWorkout',
  description: "Get the authenticated user's most recent workout day with all set records.",
  parameters: z.object({}),
  handler: async userId => analyticsService.getRecentWorkout(userId),
});

const getWorkoutHistory = defineTool({
  name: 'getWorkoutHistory',
  description: "Get the authenticated user's workout history over a number of past weeks.",
  parameters: z.object({ weeks: z.number().int().min(1).max(52).default(12) }),
  handler: async (userId, args) => analyticsService.getWorkoutHistory(userId, args.weeks),
});

const getExerciseHistory = defineTool({
  name: 'getExerciseHistory',
  description: 'Get every logged set for a specific exercise, oldest to newest.',
  parameters: z.object({
    exerciseName: z.string().min(1),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  handler: async (userId, args) =>
    analyticsService.getExerciseHistory(userId, args.exerciseName, args.limit),
});

const getWeeklyVolume = defineTool({
  name: 'getWeeklyVolume',
  description: 'Get total training volume (weight x reps) grouped by week.',
  parameters: z.object({ weeks: z.number().int().min(1).max(52).default(12) }),
  handler: async (userId, args) => analyticsService.getWeeklyVolume(userId, args.weeks),
});

const getTrainingFrequency = defineTool({
  name: 'getTrainingFrequency',
  description: 'Get how many completed training sessions per week over a window.',
  parameters: z.object({ weeks: z.number().int().min(1).max(52).default(12) }),
  handler: async (userId, args) => analyticsService.getTrainingFrequency(userId, args.weeks),
});

const getRecentPerformance = defineTool({
  name: 'getRecentPerformance',
  description: 'Get the last N sessions of a specific exercise for trend analysis.',
  parameters: z.object({
    exerciseName: z.string().min(1),
    sessions: z.number().int().min(1).max(20).default(4),
  }),
  handler: async (userId, args) =>
    analyticsService.getRecentPerformance(userId, args.exerciseName, args.sessions),
});

export const analyticsTools = [
  getRecentWorkout,
  getWorkoutHistory,
  getExerciseHistory,
  getWeeklyVolume,
  getTrainingFrequency,
  getRecentPerformance,
];
