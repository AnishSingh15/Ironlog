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
});
