import { describe, expect, it } from 'vitest';
import { getMuscleContributions, MUSCLE_WEIGHTS } from '../src/services/exercise-muscle-map';

describe('getMuscleContributions', () => {
  it('gives the prime mover full weight and assisting muscles half weight', () => {
    const contributions = getMuscleContributions('Bench Press', 'Chest');
    expect(contributions).toContainEqual({ group: 'CHEST', weight: MUSCLE_WEIGHTS.primary });
    expect(contributions).toContainEqual({ group: 'SHOULDERS_FRONT', weight: MUSCLE_WEIGHTS.secondary });
    expect(contributions).toContainEqual({ group: 'TRICEPS', weight: MUSCLE_WEIGHTS.secondary });
  });

  it('falls back to the exercise broad muscle group for unmapped (custom) exercises', () => {
    const contributions = getMuscleContributions('Cable Chest Press 3000', 'Chest');
    expect(contributions).toEqual([{ group: 'CHEST', weight: MUSCLE_WEIGHTS.primary }]);
  });

  it('excludes cardio exercises entirely - weight x reps does not describe cardio work', () => {
    expect(getMuscleContributions('Running', 'Cardio')).toEqual([]);
    expect(getMuscleContributions('Some New Cardio Machine', 'Cardio')).toEqual([]);
  });

  it('has no fallback for Full Body (ambiguous) unmapped exercises', () => {
    expect(getMuscleContributions('Some New Full Body Move', 'Full Body')).toEqual([]);
  });
});
