import { PrismaClient } from '@prisma/client';

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
}

export const analyticsService = new AnalyticsService();
