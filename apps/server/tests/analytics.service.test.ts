import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyticsService } from '../src/services/analytics.service';

const prisma = new PrismaClient();

async function seedUserWithSets() {
  const user = await prisma.user.create({
    data: { name: 'Analytics User', email: `analytics-${Date.now()}@example.com`, passwordHash: 'x' },
  });
  const exercise = await prisma.exercise.upsert({
    where: { name: 'Bench Press' },
    update: {},
    create: { name: 'Bench Press', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 8 },
  });

  const dates = [
    new Date('2026-08-01T00:00:00.000Z'),
    new Date('2026-08-04T00:00:00.000Z'),
    new Date('2026-08-08T00:00:00.000Z'),
  ];

  for (const [i, date] of dates.entries()) {
    const day = await prisma.workoutDay.create({
      data: { userId: user.id, date, completed: true },
    });
    await prisma.setRecord.createMany({
      data: [
        {
          workoutDayId: day.id,
          exerciseId: exercise.id,
          setIndex: 1,
          plannedWeight: 60,
          plannedReps: 8,
          actualWeight: 60 + i * 2.5,
          actualReps: 8,
          secondsRest: 90,
        },
      ],
    });
  }

  return { user, exercise };
}

describe('analyticsService', () => {
  beforeEach(async () => {
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.exercise.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterEach(async () => {
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.exercise.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it("getRecentWorkout returns only the calling user's most recent workout", async () => {
    const { user } = await seedUserWithSets();
    const otherUser = await prisma.user.create({
      data: { name: 'Other', email: `other-${Date.now()}@example.com`, passwordHash: 'x' },
    });

    const recent = await analyticsService.getRecentWorkout(user.id);
    expect(recent?.userId).toBe(user.id);

    const otherRecent = await analyticsService.getRecentWorkout(otherUser.id);
    expect(otherRecent).toBeNull();
  });

  it('getExerciseHistory returns sets ordered oldest to newest', async () => {
    const { user } = await seedUserWithSets();
    const history = await analyticsService.getExerciseHistory(user.id, 'Bench Press');
    expect(history).toHaveLength(3);
    expect(history[0]?.actualWeight).toBe(60);
    expect(history[2]?.actualWeight).toBe(65);
  });

  it('getWeeklyVolume sums actualWeight * actualReps per ISO week', async () => {
    const { user } = await seedUserWithSets();
    const volume = await analyticsService.getWeeklyVolume(user.id, 8);
    const totalVolume = volume.reduce((sum, week) => sum + week.totalVolume, 0);
    expect(totalVolume).toBeCloseTo(60 * 8 + 62.5 * 8 + 65 * 8);
  });

  it('getTrainingFrequency counts completed workout days per week', async () => {
    const { user } = await seedUserWithSets();
    const frequency = await analyticsService.getTrainingFrequency(user.id, 8);
    expect(frequency.totalSessions).toBe(3);
  });

  it('getRecentPerformance returns the last N sessions for an exercise', async () => {
    const { user } = await seedUserWithSets();
    const performance = await analyticsService.getRecentPerformance(user.id, 'Bench Press', 2);
    expect(performance).toHaveLength(2);
    expect(performance[0]?.actualWeight).toBe(62.5);
    expect(performance[1]?.actualWeight).toBe(65);
  });

  it('getMuscleGroupVolume sums volume grouped by exercise muscle group', async () => {
    const { user } = await seedUserWithSets();
    const volume = await analyticsService.getMuscleGroupVolume(user.id, 8);
    expect(volume).toEqual([
      { muscleGroup: 'Chest', totalVolume: 60 * 8 + 62.5 * 8 + 65 * 8 },
    ]);
  });

  it('getPersonalRecords returns the best set (highest weight) per exercise', async () => {
    const { user } = await seedUserWithSets();
    const records = await analyticsService.getPersonalRecords(user.id);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ exercise: 'Bench Press', weightKg: 65, reps: 8 });
  });

  it('getConsistency is 100% when every logged non-rest day was completed', async () => {
    const { user } = await seedUserWithSets();
    const consistency = await analyticsService.getConsistency(user.id, 8);
    expect(consistency).toBe(100);
  });

  it('getConsistency returns 0 when there are no logged workout days', async () => {
    const user = await prisma.user.create({
      data: { name: 'No Workouts', email: `no-workouts-${Date.now()}@example.com`, passwordHash: 'x' },
    });
    const consistency = await analyticsService.getConsistency(user.id, 8);
    expect(consistency).toBe(0);
  });

  it('getTopPlateauAlert finds a plateaued exercise from real history', async () => {
    const user = await prisma.user.create({
      data: { name: 'Plateau User', email: `plateau-${Date.now()}@example.com`, passwordHash: 'x' },
    });
    const exercise = await prisma.exercise.upsert({
      where: { name: 'Squat' },
      update: {},
      create: { name: 'Squat', muscleGroup: 'Legs', defaultSets: 3, defaultReps: 8 },
    });

    // Four sessions at the same weight, never hitting the target reps - a plateau.
    for (let i = 0; i < 4; i++) {
      const day = await prisma.workoutDay.create({
        data: {
          userId: user.id,
          date: new Date(Date.UTC(2026, 6, 1 + i * 3)),
          completed: true,
        },
      });
      await prisma.setRecord.create({
        data: {
          workoutDayId: day.id,
          exerciseId: exercise.id,
          setIndex: 1,
          actualWeight: 100,
          actualReps: 5,
        },
      });
    }

    const alert = await analyticsService.getTopPlateauAlert(user.id);
    expect(alert).toMatchObject({ exercise: 'Squat', trend: 'flat' });
  });

  it('getTopPlateauAlert returns null when nothing has plateaued', async () => {
    const { user } = await seedUserWithSets();
    const alert = await analyticsService.getTopPlateauAlert(user.id);
    expect(alert).toBeNull();
  });

  it('getWeekCalendar returns 7 days with completed/rest statuses from real rows', async () => {
    const user = await prisma.user.create({
      data: { name: 'Calendar User', email: `cal-${Date.now()}@example.com`, passwordHash: 'x' },
    });

    const now = new Date();
    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const isoDay = weekStart.getUTCDay() || 7;
    if (isoDay !== 1) weekStart.setUTCDate(weekStart.getUTCDate() - (isoDay - 1));

    await prisma.workoutDay.create({ data: { userId: user.id, date: weekStart, completed: true } });
    const tuesday = new Date(weekStart);
    tuesday.setUTCDate(tuesday.getUTCDate() + 1);
    await prisma.workoutDay.create({ data: { userId: user.id, date: tuesday, isRestDay: true } });

    const days = await analyticsService.getWeekCalendar(user.id, weekStart);
    expect(days).toHaveLength(7);
    expect(days[0]?.status).toBe('completed');
    expect(days[1]?.status).toBe('rest');
  });

  it('getPlateauScan returns every plateaued exercise with real reasoning, not just the top one', async () => {
    const user = await prisma.user.create({
      data: { name: 'Stuck User', email: `stuck-${Date.now()}@example.com`, passwordHash: 'x' },
    });
    const squat = await prisma.exercise.upsert({
      where: { name: 'Squat' },
      update: {},
      create: { name: 'Squat', muscleGroup: 'Legs', defaultSets: 3, defaultReps: 8 },
    });
    const ohp = await prisma.exercise.upsert({
      where: { name: 'Overhead Press' },
      update: {},
      create: { name: 'Overhead Press', muscleGroup: 'Shoulders', defaultSets: 3, defaultReps: 8 },
    });

    for (const exercise of [squat, ohp]) {
      for (let i = 0; i < 4; i++) {
        const day = await prisma.workoutDay.create({
          data: { userId: user.id, date: new Date(Date.UTC(2026, 6, 1 + i * 3, exercise === squat ? 1 : 2)), completed: true },
        });
        await prisma.setRecord.create({
          data: { workoutDayId: day.id, exerciseId: exercise.id, setIndex: 1, actualWeight: 100, actualReps: 5 },
        });
      }
    }

    const scan = await analyticsService.getPlateauScan(user.id);
    expect(scan.map(p => p.exercise).sort()).toEqual(['Overhead Press', 'Squat']);
    expect(scan[0]?.reasoning).toContain('sessions');
  });

  it('getWeekReview reports real sessions, volume, and PRs for the current week', async () => {
    const user = await prisma.user.create({
      data: { name: 'Review User', email: `review-${Date.now()}@example.com`, passwordHash: 'x' },
    });
    const exercise = await prisma.exercise.upsert({
      where: { name: 'Deadlift' },
      update: {},
      create: { name: 'Deadlift', muscleGroup: 'Back', defaultSets: 3, defaultReps: 5 },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const day = await prisma.workoutDay.create({ data: { userId: user.id, date: today, completed: true } });
    await prisma.setRecord.create({
      data: { workoutDayId: day.id, exerciseId: exercise.id, setIndex: 1, actualWeight: 140, actualReps: 5 },
    });

    const review = await analyticsService.getWeekReview(user.id);
    expect(review.sessionsThisWeek).toBe(1);
    expect(review.volumeThisWeek).toBe(700);
    expect(review.personalRecordsThisWeek).toEqual([
      expect.objectContaining({ exercise: 'Deadlift', weightKg: 140 }),
    ]);
  });

  it('getTodayAdaptation recommends only for exercises with enough history, on today\'s incomplete sets', async () => {
    const user = await prisma.user.create({
      data: { name: 'Adapt User', email: `adapt-${Date.now()}@example.com`, passwordHash: 'x' },
    });
    const exercise = await prisma.exercise.upsert({
      where: { name: 'Bench Press' },
      update: {},
      create: { name: 'Bench Press', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 8 },
    });

    // Two prior completed sessions give calculateProgress enough history to act on.
    for (const [i, date] of [
      new Date(Date.UTC(2026, 6, 1)),
      new Date(Date.UTC(2026, 6, 4)),
    ].entries()) {
      const day = await prisma.workoutDay.create({ data: { userId: user.id, date, completed: true } });
      await prisma.setRecord.create({
        data: { workoutDayId: day.id, exerciseId: exercise.id, setIndex: 1, actualWeight: 60 + i * 2.5, actualReps: 8 },
      });
    }

    // Today's workout has one incomplete set for the same exercise. Matches how workout
    // days are actually created elsewhere (local server time, not UTC).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayWorkout = await prisma.workoutDay.create({ data: { userId: user.id, date: today } });
    const incompleteSet = await prisma.setRecord.create({
      data: { workoutDayId: todayWorkout.id, exerciseId: exercise.id, setIndex: 1, plannedWeight: 62.5, plannedReps: 8 },
    });

    const adaptations = await analyticsService.getTodayAdaptation(user.id);
    expect(adaptations).toHaveLength(1);
    expect(adaptations[0]?.exercise).toBe('Bench Press');
    expect(adaptations[0]?.setIds).toEqual([incompleteSet.id]);
    expect(adaptations[0]?.recommendation.action).toBeDefined();
  });
});
