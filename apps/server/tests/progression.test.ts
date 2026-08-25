import { describe, expect, it } from 'vitest';
import { calculateProgress } from '../src/services/progression';
import type { PerformedSet } from '../src/services/analytics.service';

function makeSet(actualWeight: number, actualReps: number, daysAgo: number): PerformedSet {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return { date, actualWeight, actualReps, plannedWeight: actualWeight, plannedReps: 8, setIndex: 1 };
}

describe('calculateProgress', () => {
  it('recommends increasing weight when the last sessions met or beat target reps', () => {
    const sets = [makeSet(60, 8, 21), makeSet(62.5, 8, 14), makeSet(62.5, 9, 7)];
    const result = calculateProgress(sets, 8, 'Chest');

    expect(result.action).toBe('increase_weight');
    expect(result.recommendedWeightKg).toBe(65);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('uses the larger lower-body increment for leg exercises', () => {
    const sets = [makeSet(80, 10, 14), makeSet(80, 10, 7)];
    const result = calculateProgress(sets, 10, 'Legs');

    expect(result.action).toBe('increase_weight');
    expect(result.recommendedWeightKg).toBe(85);
  });

  it('recommends a deload when reps have dropped sharply for two sessions', () => {
    const sets = [makeSet(70, 8, 21), makeSet(70, 5, 14), makeSet(70, 4, 7)];
    const result = calculateProgress(sets, 8, 'Chest');

    expect(result.action).toBe('deload');
    expect(result.recommendedWeightKg).toBeLessThan(70);
  });

  it('recommends maintaining load when performance is inconsistent but not failing', () => {
    const sets = [makeSet(70, 8, 21), makeSet(70, 6, 14), makeSet(70, 7, 7)];
    const result = calculateProgress(sets, 8, 'Chest');

    expect(result.action).toBe('maintain');
    expect(result.recommendedWeightKg).toBe(70);
  });

  it('returns insufficient_data with zero confidence for fewer than 2 sessions', () => {
    const result = calculateProgress([makeSet(60, 8, 1)], 8, 'Chest');
    expect(result.action).toBe('insufficient_data');
    expect(result.confidence).toBe(0);
  });
});
