import { describe, expect, it } from 'vitest';
import { detectPlateau } from '../src/services/plateau';
import type { PerformedSet } from '../src/services/analytics.service';

function makeSet(actualWeight: number, actualReps: number, daysAgo: number): PerformedSet {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return { date, actualWeight, actualReps, plannedWeight: actualWeight, plannedReps: 8, setIndex: 1 };
}

describe('detectPlateau', () => {
  it('flags a plateau when weight and reps are flat across 4+ sessions', () => {
    const sets = [makeSet(70, 8, 28), makeSet(70, 8, 21), makeSet(70, 7, 14), makeSet(70, 8, 7)];
    const result = detectPlateau(sets, 8);

    expect(result.status).toBe('plateau');
    expect(result.durationSessions).toBe(4);
    expect(result.trend).toBe('flat');
  });

  it('reports progressing when weight increased across the window', () => {
    const sets = [makeSet(60, 8, 28), makeSet(62.5, 8, 21), makeSet(65, 8, 14), makeSet(67.5, 8, 7)];
    const result = detectPlateau(sets, 8);

    expect(result.status).toBe('progressing');
    expect(result.trend).toBe('upward');
  });

  it('returns insufficient_data with fewer than 4 sessions', () => {
    const sets = [makeSet(70, 8, 14), makeSet(70, 8, 7)];
    const result = detectPlateau(sets, 8);

    expect(result.status).toBe('insufficient_data');
    expect(result.confidence).toBe(0);
  });
});
