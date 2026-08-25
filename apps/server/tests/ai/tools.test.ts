import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/analytics.service', () => ({
  analyticsService: {
    getRecentPerformance: vi.fn(async (_userId: string, _exerciseName: string) => [
      {
        date: new Date('2026-08-01'),
        actualWeight: 60,
        actualReps: 8,
        plannedWeight: 60,
        plannedReps: 8,
        setIndex: 1,
      },
    ]),
    getWeeklyVolume: vi.fn(async () => [
      { weekStart: new Date('2026-08-01'), totalVolume: 480, sessionCount: 1 },
    ]),
  },
}));

describe('analyticsTools', () => {
  it('getRecentPerformance tool validates input and returns the service result', async () => {
    const { analyticsTools } = await import('../../src/ai/tools/analyticsTools');
    const tool = analyticsTools.find(t => t.name === 'getRecentPerformance');
    expect(tool).toBeDefined();

    const parsed = tool!.parameters.parse({ exerciseName: 'Bench Press', sessions: 3 });
    const result = await tool!.handler('user_1', parsed);
    expect(result).toHaveLength(1);
  });

  it('getRecentPerformance tool rejects missing exerciseName', async () => {
    const { analyticsTools } = await import('../../src/ai/tools/analyticsTools');
    const tool = analyticsTools.find(t => t.name === 'getRecentPerformance');
    expect(() => tool!.parameters.parse({})).toThrow();
  });
});

describe('progressionTools', () => {
  it('calculateProgress tool combines exercise history with the progression engine', async () => {
    vi.doMock('../../src/services/analytics.service', () => ({
      analyticsService: {
        getRecentPerformance: vi.fn(async () => [
          {
            date: new Date(),
            actualWeight: 60,
            actualReps: 8,
            plannedWeight: 60,
            plannedReps: 8,
            setIndex: 1,
          },
          {
            date: new Date(),
            actualWeight: 62.5,
            actualReps: 9,
            plannedWeight: 62.5,
            plannedReps: 8,
            setIndex: 1,
          },
        ]),
      },
    }));
    const { progressionTools } = await import('../../src/ai/tools/progressionTools');
    const tool = progressionTools.find(t => t.name === 'calculateProgress');
    const parsed = tool!.parameters.parse({
      exerciseName: 'Bench Press',
      targetReps: 8,
      muscleGroup: 'Chest',
    });
    const result = await tool!.handler('user_1', parsed);
    expect((result as { action: string }).action).toBe('increase_weight');
  });
});
