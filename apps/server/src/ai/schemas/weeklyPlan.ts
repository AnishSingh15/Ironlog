import { z } from 'zod';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const plannedExerciseSchema = z.object({
  name: z.string(),
  targetSets: z.number().int().min(1).max(10),
  targetReps: z.string(),
});

export const plannedSessionSchema = z.object({
  day: z.enum(DAYS_OF_WEEK),
  focus: z.string(),
  isRestDay: z.boolean(),
  exercises: z.array(plannedExerciseSchema),
  reasoning: z.string(),
});

export const weeklyPlanSchema = z.object({
  goal: z.string(),
  summary: z.string(),
  sessions: z.array(plannedSessionSchema).length(7),
});

export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>;

export const planWeekRequestSchema = z.object({
  goal: z.string().min(1).max(200).optional(),
  availableDays: z.array(z.enum(DAYS_OF_WEEK)).optional(),
  sessionDurationMinutes: z.number().int().min(15).max(180).optional(),
  equipment: z.array(z.string().min(1)).optional(),
});

export type PlanWeekRequest = z.infer<typeof planWeekRequestSchema>;
