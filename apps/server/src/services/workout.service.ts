import { Exercise, PrismaClient } from '@prisma/client';
import { analyticsService, startOfIsoWeek } from './analytics.service';
import type { WeeklyPlan } from '../ai/schemas/weeklyPlan';

const DAY_INDEX: Record<WeeklyPlan['sessions'][number]['day'], number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

export interface SavePlanResult {
  savedDays: string[];
  skippedDays: { day: string; reason: string }[];
}

const prisma = new PrismaClient();

type SplitKey = 'CHEST_TRI' | 'BACK_BI' | 'LEGS_SHO';

const SPLIT_CONFIGS: Record<SplitKey, { groups: string[]; maxPerGroup: Record<string, number> }> = {
  CHEST_TRI: {
    groups: ['Chest', 'Triceps'],
    maxPerGroup: { Chest: 3, Triceps: 2 },
  },
  BACK_BI: {
    groups: ['Back', 'Biceps'],
    maxPerGroup: { Back: 3, Biceps: 2 },
  },
  LEGS_SHO: {
    groups: ['Legs', 'Shoulders'],
    maxPerGroup: { Legs: 3, Shoulders: 2 },
  },
};

export class WorkoutService {
  async getTodayWorkout(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if workout day exists for today
    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        userId,
        date: today,
      },
      include: {
        setRecords: {
          include: {
            exercise: true,
          },
          orderBy: [{ exercise: { name: 'asc' } }, { setIndex: 'asc' }],
        },
      },
    });

    return workoutDay;
  }

  async startWorkout(userId: string, splitKey: SplitKey) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if workout day already exists for today
    const existingWorkout = await this.getTodayWorkout(userId);
    if (existingWorkout) {
      return existingWorkout;
    }

    const splitConfig = SPLIT_CONFIGS[splitKey];
    const { groups, maxPerGroup } = splitConfig;

    // Get exercises for the muscle groups with limits
    const exercisesByGroup: Record<
      string,
      Array<{
        id: string;
        name: string;
        muscleGroup: string;
        defaultSets: number;
        defaultReps: number;
        createdAt: Date;
        updatedAt: Date;
      }>
    > = {};

    for (const muscleGroup of groups) {
      const exercises = await prisma.exercise.findMany({
        where: {
          muscleGroup,
        },
        take: maxPerGroup[muscleGroup] || 3,
        orderBy: {
          name: 'asc',
        },
      });
      exercisesByGroup[muscleGroup] = exercises;
    }

    // Flatten all exercises
    const allExercises = Object.values(exercisesByGroup).flat();

    if (allExercises.length === 0) {
      throw new Error('No exercises found for the selected workout split');
    }

    // Create workout day
    const createdWorkoutDay = await prisma.workoutDay.create({
      data: {
        userId,
        date: today,
        completed: false,
      },
    });

    // Create set records for each exercise using defaultSets + defaultReps
    const setRecordsData = allExercises.flatMap(exercise =>
      Array.from({ length: exercise.defaultSets }, (_, setIndex) => ({
        workoutDayId: createdWorkoutDay.id,
        exerciseId: exercise.id,
        setIndex: setIndex + 1,
        plannedReps: exercise.defaultReps,
        plannedWeight: 0, // Default weight
        actualReps: null,
        actualWeight: null,
      }))
    );

    await prisma.setRecord.createMany({
      data: setRecordsData,
    });

    // Return workout day with set records
    return prisma.workoutDay.findUnique({
      where: { id: createdWorkoutDay.id },
      include: {
        setRecords: {
          include: {
            exercise: true,
          },
          orderBy: [{ exercise: { name: 'asc' } }, { setIndex: 'asc' }],
        },
      },
    });
  }

  async completeWorkout(userId: string, workoutDayId: string) {
    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: workoutDayId,
        userId,
      },
    });

    if (!workoutDay) {
      throw new Error('Workout day not found');
    }

    return prisma.workoutDay.update({
      where: { id: workoutDayId },
      data: { completed: true },
      include: {
        setRecords: {
          include: {
            exercise: true,
          },
        },
      },
    });
  }

  async getWorkoutHistory(userId: string, startDate?: string, endDate?: string) {
    const whereClause: {
      userId: string;
      date?: {
        gte: Date;
        lte: Date;
      };
    } = {
      userId,
    };

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    return prisma.workoutDay.findMany({
      where: whereClause,
      include: {
        setRecords: {
          include: {
            exercise: true,
          },
          orderBy: [{ exercise: { name: 'asc' } }, { setIndex: 'asc' }],
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async getWorkoutStats(userId: string) {
    const totalWorkouts = await prisma.workoutDay.count({
      where: {
        userId,
        completed: true,
      },
    });

    const totalSetsCompleted = await prisma.setRecord.count({
      where: {
        workoutDay: {
          userId,
        },
        actualWeight: {
          not: null,
        },
        actualReps: {
          not: null,
        },
      },
    });

    // Calculate current streak
    const recentWorkouts = await prisma.workoutDay.findMany({
      where: {
        userId,
      },
      orderBy: {
        date: 'desc',
      },
      take: 30, // Look at last 30 days
    });

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const workout of recentWorkouts) {
      const workoutDate = new Date(workout.date);
      workoutDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === currentStreak && workout.completed) {
        currentStreak++;
      } else {
        break;
      }
    }

    const personalRecords = await analyticsService.getPersonalRecords(userId);

    return {
      totalWorkouts,
      totalSetsCompleted,
      currentStreak,
      personalRecords,
    };
  }

  // Helper function to determine split name from exercises
  getSplitName(setRecords: Array<{ exercise: { muscleGroup: string } }>): string {
    const muscleGroups = [...new Set(setRecords.map(record => record.exercise.muscleGroup))];
    muscleGroups.sort();
    return muscleGroups.join(' + ');
  }

  async createCustomWorkout(
    userId: string,
    exerciseIds: string[],
    customSets?: Record<string, number>
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if workout day already exists for today
    const existingWorkout = await this.getTodayWorkout(userId);
    if (existingWorkout) {
      return existingWorkout;
    }

    // Get the selected exercises
    const exercises = await prisma.exercise.findMany({
      where: {
        id: {
          in: exerciseIds,
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    if (exercises.length === 0) {
      throw new Error('No valid exercises found');
    }

    // Create workout day
    const createdWorkoutDay = await prisma.workoutDay.create({
      data: {
        userId,
        date: today,
        completed: false,
      },
    });

    // Create set records for each exercise
    const setRecordsData = exercises.flatMap((exercise: Exercise) => {
      const numberOfSets = customSets?.[exercise.id] || exercise.defaultSets;
      return Array.from({ length: numberOfSets }, (_, setIndex) => ({
        workoutDayId: createdWorkoutDay.id,
        exerciseId: exercise.id,
        setIndex: setIndex + 1,
        plannedReps: exercise.defaultReps,
        plannedWeight: 0, // Default weight
        actualReps: null,
        actualWeight: null,
      }));
    });

    await prisma.setRecord.createMany({
      data: setRecordsData,
    });

    // Return the created workout with all relations
    const workoutWithRecords = await prisma.workoutDay.findUnique({
      where: { id: createdWorkoutDay.id },
      include: {
        setRecords: {
          include: {
            exercise: true,
          },
          orderBy: [{ exercise: { name: 'asc' } }, { setIndex: 'asc' }],
        },
      },
    });

    return workoutWithRecords;
  }

  async createRestDay(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if workout day already exists for today
    const existingWorkout = await this.getTodayWorkout(userId);
    if (existingWorkout) {
      // Update existing workout to be a rest day
      const updatedWorkout = await prisma.workoutDay.update({
        where: { id: existingWorkout.id },
        data: {
          completed: true,
          isRestDay: true,
        },
        include: {
          setRecords: {
            include: {
              exercise: true,
            },
            orderBy: [{ exercise: { name: 'asc' } }, { setIndex: 'asc' }],
          },
        },
      });
      return updatedWorkout;
    }

    // Create new rest day workout
    const restDayWorkout = await prisma.workoutDay.create({
      data: {
        userId,
        date: today,
        completed: true,
        isRestDay: true,
      },
      include: {
        setRecords: {
          include: {
            exercise: true,
          },
          orderBy: [{ exercise: { name: 'asc' } }, { setIndex: 'asc' }],
        },
      },
    });

    return restDayWorkout;
  }

  // Persists an AI-generated weekly plan as real WorkoutDay/SetRecord rows for the
  // current ISO week (same week boundary as the Weekly Calendar/Week Review use), so
  // it shows up as the user's actual scheduled training rather than staying a one-off
  // suggestion that disappears on refresh. Exercises the plan names that don't exist
  // yet are created (same "Full Body" fallback category the manual add-exercise flow
  // allows) rather than silently dropped.
  async saveWeeklyPlan(userId: string, plan: WeeklyPlan): Promise<SavePlanResult> {
    const weekStart = startOfIsoWeek(new Date());
    const savedDays: string[] = [];
    const skippedDays: { day: string; reason: string }[] = [];

    for (const session of plan.sessions) {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + DAY_INDEX[session.day]);

      const existing = await prisma.workoutDay.findUnique({ where: { date } });
      if (existing) {
        skippedDays.push({
          day: session.day,
          reason: existing.userId === userId ? 'Already has a workout scheduled' : 'Date unavailable',
        });
        continue;
      }

      if (session.isRestDay) {
        await prisma.workoutDay.create({ data: { userId, date, isRestDay: true, completed: false } });
        savedDays.push(session.day);
        continue;
      }

      const workoutDay = await prisma.workoutDay.create({ data: { userId, date, isRestDay: false, completed: false } });

      for (const planned of session.exercises) {
        const exercise = await prisma.exercise.upsert({
          where: { name: planned.name },
          update: {},
          create: {
            name: planned.name,
            muscleGroup: 'Full Body',
            defaultSets: planned.targetSets,
            defaultReps: parseInt(planned.targetReps, 10) || 10,
          },
        });

        const plannedReps = parseInt(planned.targetReps, 10) || null;
        for (let setIndex = 0; setIndex < planned.targetSets; setIndex++) {
          await prisma.setRecord.create({
            data: { workoutDayId: workoutDay.id, exerciseId: exercise.id, setIndex, plannedReps },
          });
        }
      }

      savedDays.push(session.day);
    }

    return { savedDays, skippedDays };
  }
}

export const workoutService = new WorkoutService();
