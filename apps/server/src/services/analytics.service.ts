import { PrismaClient } from '@prisma/client';
import type { MuscleGroup } from '@musclemap/core';
import { detectPlateau, type PlateauTrend } from './plateau';
import { calculateProgress, type ProgressionRecommendation } from './progression';
import { getMuscleContributions } from './exercise-muscle-map';

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

export interface MuscleVolumeTrendPoint {
  bucketStart: Date;
  volumeKg: number;
}

export interface MuscleVolumeEntry {
  volumeKg: number;
  sets: number;
  intensity: number;
  trendPct: number | null;
  topExercises: string[];
  trendSeries: MuscleVolumeTrendPoint[];
}

export interface MuscleVolumeBreakdown {
  period: { start: Date; end: Date; rangeDays: number };
  muscles: Partial<Record<MuscleGroup, MuscleVolumeEntry>>;
}

export const MUSCLE_TIME_RANGES = { '7D': 7, '4W': 28, '8W': 56, '12W': 84, '6M': 182 } as const;
export type MuscleTimeRange = keyof typeof MUSCLE_TIME_RANGES;

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

export interface PlateauScanEntry {
  exercise: string;
  durationSessions: number;
  trend: PlateauTrend;
  confidence: number;
  reasoning: string;
}

export interface WeekReview {
  sessionsThisWeek: number;
  volumeThisWeek: number;
  volumeLastWeek: number;
  volumeChangePct: number | null;
  personalRecordsThisWeek: PersonalRecord[];
  plateauedExercises: string[];
}

export interface TodayAdaptation {
  exercise: string;
  setIds: string[];
  recommendation: ProgressionRecommendation;
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
    return { exercise: best.exercise, durationSessions: best.durationSessions, trend: best.trend };
  }

  // Every plateaued exercise (not just the top one), each with its own reasoning - powers
  // "Why Am I Stuck?". Deterministic, no LLM call.
  async getPlateauScan(userId: string): Promise<PlateauScanEntry[]> {
    const recentExercises = await prisma.setRecord.findMany({
      where: { workoutDay: { userId }, actualWeight: { not: null }, actualReps: { not: null } },
      distinct: ['exerciseId'],
      orderBy: { workoutDay: { date: 'desc' } },
      include: { exercise: true },
      take: 20,
    });

    const entries: PlateauScanEntry[] = [];

    for (const record of recentExercises) {
      const history = await this.getExerciseHistory(userId, record.exercise.name, 20);
      const result = detectPlateau(history, record.exercise.defaultReps);

      if (result.status === 'plateau') {
        const trendCopy =
          result.trend === 'flat'
            ? 'the weight has stayed exactly the same'
            : 'the weight is moving down, not up';
        entries.push({
          exercise: record.exercise.name,
          durationSessions: result.durationSessions,
          trend: result.trend,
          confidence: result.confidence,
          reasoning: `Over your last ${result.durationSessions} sessions, ${trendCopy} without consistently hitting the ${record.exercise.defaultReps}-rep target.`,
        });
      }
    }

    return entries.sort((a, b) => b.confidence - a.confidence);
  }

  // Deterministic weekly summary - real sessions/volume/PRs/plateaus, no invented copy.
  async getWeekReview(userId: string): Promise<WeekReview> {
    const thisWeekStart = startOfIsoWeek(new Date());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
    const nextWeekStart = new Date(thisWeekStart);
    nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);

    const [sessionsThisWeek, weeklyVolume, personalRecords, plateauScan] = await Promise.all([
      prisma.workoutDay.count({
        where: { userId, date: { gte: thisWeekStart, lt: nextWeekStart }, completed: true, isRestDay: false },
      }),
      this.getWeeklyVolume(userId, 2),
      this.getPersonalRecords(userId),
      this.getPlateauScan(userId),
    ]);

    const thisWeek = weeklyVolume.find(w => w.weekStart.getTime() === thisWeekStart.getTime());
    const lastWeek = weeklyVolume.find(w => w.weekStart.getTime() === lastWeekStart.getTime());
    const volumeThisWeek = thisWeek?.totalVolume ?? 0;
    const volumeLastWeek = lastWeek?.totalVolume ?? 0;
    const volumeChangePct =
      volumeLastWeek > 0 ? Math.round(((volumeThisWeek - volumeLastWeek) / volumeLastWeek) * 100) : null;

    const personalRecordsThisWeek = personalRecords.filter(
      pr => pr.achievedAt >= thisWeekStart && pr.achievedAt < nextWeekStart
    );

    return {
      sessionsThisWeek,
      volumeThisWeek,
      volumeLastWeek,
      volumeChangePct,
      personalRecordsThisWeek,
      plateauedExercises: plateauScan.map(p => p.exercise),
    };
  }

  // Deterministic per-exercise recommendations for today's not-yet-completed sets - powers
  // "Adapt Today's Workout". The caller applies a recommendation by PATCHing plannedWeight/
  // plannedReps on the returned setIds; nothing is mutated here.
  async getTodayAdaptation(userId: string): Promise<TodayAdaptation[]> {
    // Matches workout.service.ts's convention exactly (setHours, not setUTCHours) -
    // WorkoutDay.date is written using local server time everywhere else, so a UTC-based
    // "today" here would silently miss it whenever the server isn't running in UTC.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const workoutDay = await prisma.workoutDay.findFirst({
      where: { userId, date: today },
      include: { setRecords: { include: { exercise: true } } },
    });

    if (!workoutDay) return [];

    const incompleteByExercise = new Map<
      string,
      { exerciseName: string; defaultReps: number; muscleGroup: string; setIds: string[] }
    >();

    for (const set of workoutDay.setRecords) {
      if (set.actualWeight !== null && set.actualReps !== null) continue; // already logged
      const existing = incompleteByExercise.get(set.exercise.id);
      if (existing) {
        existing.setIds.push(set.id);
      } else {
        incompleteByExercise.set(set.exercise.id, {
          exerciseName: set.exercise.name,
          defaultReps: set.exercise.defaultReps,
          muscleGroup: set.exercise.muscleGroup,
          setIds: [set.id],
        });
      }
    }

    const adaptations: TodayAdaptation[] = [];
    for (const { exerciseName, defaultReps, muscleGroup, setIds } of incompleteByExercise.values()) {
      const history = await this.getExerciseHistory(userId, exerciseName, 20);
      if (history.length < 2) continue; // insufficient_data isn't worth surfacing here

      const recommendation = calculateProgress(history, defaultReps, muscleGroup);
      if (recommendation.action === 'insufficient_data') continue;

      adaptations.push({ exercise: exerciseName, setIds, recommendation });
    }

    return adaptations;
  }

  // Fine-grained (21-muscle) volume breakdown powering the MuscleMap dashboard section.
  // Reuses the exact `actualWeight * actualReps` formula from getMuscleGroupVolume, just
  // spread across muscles via the primary/secondary weighting in exercise-muscle-map.ts.
  // actualWeight is treated as kg with no conversion, matching the existing convention
  // already established by getPersonalRecords (which labels the raw stored value weightKg).
  async getMuscleVolumeBreakdown(userId: string, rangeDays: number): Promise<MuscleVolumeBreakdown> {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - rangeDays);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - rangeDays);

    const bucketDays = rangeDays <= 7 ? 1 : rangeDays <= 84 ? 7 : 14;

    const [current, previous] = await Promise.all([
      this.aggregateMuscleVolume(userId, start, end, bucketDays),
      this.aggregateMuscleVolume(userId, prevStart, start, bucketDays),
    ]);

    const maxVolume = Math.max(0, ...[...current.values()].map(v => v.volume));

    const muscles: Partial<Record<MuscleGroup, MuscleVolumeEntry>> = {};
    for (const [group, entry] of current.entries()) {
      if (entry.volume <= 0) continue;
      const prevVolume = previous.get(group)?.volume ?? 0;
      const trendPct =
        prevVolume > 0 ? Math.round(((entry.volume - prevVolume) / prevVolume) * 100) : entry.volume > 0 ? 100 : null;

      muscles[group] = {
        volumeKg: Math.round(entry.volume),
        sets: entry.sets,
        intensity: maxVolume > 0 ? Math.round(100 * Math.sqrt(entry.volume / maxVolume)) : 0,
        trendPct,
        topExercises: [...entry.byExercise.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name),
        trendSeries: [...entry.buckets.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([bucketStartMs, volumeKg]) => ({ bucketStart: new Date(bucketStartMs), volumeKg: Math.round(volumeKg) })),
      };
    }

    return { period: { start, end, rangeDays }, muscles };
  }

  private async aggregateMuscleVolume(userId: string, start: Date, end: Date, bucketDays: number) {
    const records = await prisma.setRecord.findMany({
      where: {
        workoutDay: { userId, date: { gte: start, lt: end } },
        actualWeight: { not: null },
        actualReps: { not: null },
      },
      include: { exercise: true, workoutDay: { select: { date: true } } },
    });

    const byGroup = new Map<
      MuscleGroup,
      { volume: number; sets: number; byExercise: Map<string, number>; buckets: Map<number, number> }
    >();

    for (const record of records) {
      const setVolume = (record.actualWeight as number) * (record.actualReps as number);
      const contributions = getMuscleContributions(record.exercise.name, record.exercise.muscleGroup);
      if (contributions.length === 0) continue;

      const bucketMs =
        start.getTime() +
        Math.floor((record.workoutDay.date.getTime() - start.getTime()) / (bucketDays * 86400000)) *
          bucketDays *
          86400000;

      for (const { group, weight } of contributions) {
        const weighted = setVolume * weight;
        const entry = byGroup.get(group) ?? {
          volume: 0,
          sets: 0,
          byExercise: new Map<string, number>(),
          buckets: new Map<number, number>(),
        };
        entry.volume += weighted;
        entry.sets += 1;
        entry.byExercise.set(record.exercise.name, (entry.byExercise.get(record.exercise.name) ?? 0) + weighted);
        entry.buckets.set(bucketMs, (entry.buckets.get(bucketMs) ?? 0) + weighted);
        byGroup.set(group, entry);
      }
    }

    return byGroup;
  }
}

export const analyticsService = new AnalyticsService();
