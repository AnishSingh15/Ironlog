import { PrismaClient } from '@prisma/client';
import { detectPlateau, type PlateauTrend } from './plateau';

const prisma = new PrismaClient();

export interface PerformedSet {
  date: Date;
  actualWeight: number;
  actualReps: number;
  plannedWeight: number | null;
  plannedReps: number | null;
  setIndex: number;
}

export interface WeeklyVolume {
  weekStart: Date;
  totalVolume: number;
  sessionCount: number;
}

export interface TrainingFrequency {
  totalSessions: number;
  weeksSpanned: number;
  sessionsPerWeek: number;
}

export interface MuscleGroupVolume {
  muscleGroup: string;
  totalVolume: number;
}

export interface PersonalRecord {
  exercise: string;
  weightKg: number;
  reps: number;
  achievedAt: Date;
}

export type WorkoutDayStatus = 'completed' | 'planned' | 'missed' | 'rest';

export interface WeekCalendarDay {
  date: Date;
  status: WorkoutDayStatus;
}

export interface PlateauAlert {
  exercise: string;
  durationSessions: number;
  trend: PlateauTrend;
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

export class AnalyticsService {
  async getWorkoutHistory(userId: string, weeks = 12) {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    return prisma.workoutDay.findMany({
      where: { userId, date: { gte: since } },
      include: { setRecords: { include: { exercise: true }, orderBy: { setIndex: 'asc' } } },
      orderBy: { date: 'desc' },
    });
  }

  async getRecentWorkout(userId: string) {
    return prisma.workoutDay.findFirst({
      where: { userId },
      include: { setRecords: { include: { exercise: true }, orderBy: { setIndex: 'asc' } } },
      orderBy: { date: 'desc' },
    });
  }

  async getExerciseHistory(
    userId: string,
    exerciseName: string,
    limit = 50
  ): Promise<PerformedSet[]> {
    const records = await prisma.setRecord.findMany({
      where: {
        workoutDay: { userId },
        exercise: { name: exerciseName },
        actualWeight: { not: null },
        actualReps: { not: null },
      },
      include: { workoutDay: { select: { date: true } } },
      orderBy: { workoutDay: { date: 'asc' } },
      take: limit,
    });

    return records.map(record => ({
      date: record.workoutDay.date,
      actualWeight: record.actualWeight as number,
      actualReps: record.actualReps as number,
      plannedWeight: record.plannedWeight,
      plannedReps: record.plannedReps,
      setIndex: record.setIndex,
    }));
  }

  async getWeeklyVolume(userId: string, weeks = 12): Promise<WeeklyVolume[]> {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const records = await prisma.setRecord.findMany({
      where: {
        workoutDay: { userId, date: { gte: since } },
        actualWeight: { not: null },
        actualReps: { not: null },
      },
      include: { workoutDay: { select: { date: true } } },
    });

    const byWeek = new Map<string, WeeklyVolume>();
    for (const record of records) {
      const weekStart = startOfIsoWeek(record.workoutDay.date);
      const key = weekStart.toISOString();
      const existing = byWeek.get(key) ?? { weekStart, totalVolume: 0, sessionCount: 0 };
      existing.totalVolume += (record.actualWeight as number) * (record.actualReps as number);
      byWeek.set(key, existing);
    }

    return [...byWeek.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }

  async getTrainingFrequency(userId: string, weeks = 12): Promise<TrainingFrequency> {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const totalSessions = await prisma.workoutDay.count({
      where: { userId, date: { gte: since }, completed: true, isRestDay: false },
    });

    return {
      totalSessions,
      weeksSpanned: weeks,
      sessionsPerWeek: weeks > 0 ? totalSessions / weeks : 0,
    };
  }

  async getRecentPerformance(
    userId: string,
    exerciseName: string,
    sessions = 4
  ): Promise<PerformedSet[]> {
    const history = await this.getExerciseHistory(userId, exerciseName, 500);
    return history.slice(-sessions);
  }

  async getMuscleGroupVolume(userId: string, weeks = 8): Promise<MuscleGroupVolume[]> {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const records = await prisma.setRecord.findMany({
      where: {
        workoutDay: { userId, date: { gte: since } },
        actualWeight: { not: null },
        actualReps: { not: null },
      },
      include: { exercise: { select: { muscleGroup: true } } },
    });

    const byGroup = new Map<string, number>();
    for (const record of records) {
      const volume = (record.actualWeight as number) * (record.actualReps as number);
      byGroup.set(
        record.exercise.muscleGroup,
        (byGroup.get(record.exercise.muscleGroup) ?? 0) + volume
      );
    }

    return [...byGroup.entries()]
      .map(([muscleGroup, totalVolume]) => ({ muscleGroup, totalVolume }))
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }

  // Best set (highest weight, ties broken by higher reps) per exercise across all history.
  async getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    const records = await prisma.setRecord.findMany({
      where: {
        workoutDay: { userId },
        actualWeight: { not: null },
        actualReps: { not: null },
      },
      include: { exercise: { select: { name: true } }, workoutDay: { select: { date: true } } },
    });

    const bestByExercise = new Map<string, PersonalRecord>();
    for (const record of records) {
      const weightKg = record.actualWeight as number;
      const reps = record.actualReps as number;
      const existing = bestByExercise.get(record.exercise.name);

      if (!existing || weightKg > existing.weightKg || (weightKg === existing.weightKg && reps > existing.reps)) {
        bestByExercise.set(record.exercise.name, {
          exercise: record.exercise.name,
          weightKg,
          reps,
          achievedAt: record.workoutDay.date,
        });
      }
    }

    return [...bestByExercise.values()].sort((a, b) => b.weightKg - a.weightKg);
  }

  // Share of logged (non-rest) workout days that were actually completed, over the trailing window.
  async getConsistency(userId: string, weeks = 8): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const [planned, completed] = await Promise.all([
      prisma.workoutDay.count({ where: { userId, date: { gte: since }, isRestDay: false } }),
      prisma.workoutDay.count({
        where: { userId, date: { gte: since }, isRestDay: false, completed: true },
      }),
    ]);

    return planned > 0 ? Math.round((completed / planned) * 100) : 0;
  }

  async getWeekCalendar(userId: string, weekStart?: Date): Promise<WeekCalendarDay[]> {
    const start = weekStart ? startOfIsoWeek(weekStart) : startOfIsoWeek(new Date());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const workoutDays = await prisma.workoutDay.findMany({
      where: { userId, date: { gte: start, lt: end } },
    });
    const byDate = new Map(workoutDays.map(w => [w.date.toISOString().slice(0, 10), w]));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const days: WeekCalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      const row = byDate.get(date.toISOString().slice(0, 10));

      let status: WorkoutDayStatus;
      if (row?.isRestDay) {
        status = 'rest';
      } else if (row?.completed) {
        status = 'completed';
      } else if (row) {
        status = date < today ? 'missed' : 'planned';
      } else {
        // No row logged for this date - there's no evidence a workout was ever
        // planned, so treat past days as rest rather than fabricating a "missed" day.
        status = date >= today ? 'planned' : 'rest';
      }

      days.push({ date, status });
    }

    return days;
  }

  // Deterministic plateau scan across the user's recently-trained exercises - no LLM call,
  // safe to run on every Home page load. Surfaces the single highest-confidence plateau, if any.
  async getTopPlateauAlert(userId: string): Promise<PlateauAlert | null> {
    const recentExercises = await prisma.setRecord.findMany({
      where: { workoutDay: { userId }, actualWeight: { not: null }, actualReps: { not: null } },
      distinct: ['exerciseId'],
      orderBy: { workoutDay: { date: 'desc' } },
      include: { exercise: true },
      take: 10,
    });

    let best: (PlateauAlert & { confidence: number }) | null = null;

    for (const record of recentExercises) {
      const history = await this.getExerciseHistory(userId, record.exercise.name, 20);
      const result = detectPlateau(history, record.exercise.defaultReps);

      if (result.status === 'plateau' && (!best || result.confidence > best.confidence)) {
        best = {
          exercise: record.exercise.name,
          durationSessions: result.durationSessions,
          trend: result.trend,
          confidence: result.confidence,
        };
      }
    }

    if (!best) return null;
    const { confidence: _confidence, ...alert } = best;
    return alert;
  }
}

export const analyticsService = new AnalyticsService();
