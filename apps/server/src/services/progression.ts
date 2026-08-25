import type { PerformedSet } from './analytics.service';

const LOWER_BODY_GROUPS = new Set(['Legs']);
const UPPER_BODY_INCREMENT_KG = 2.5;
const LOWER_BODY_INCREMENT_KG = 5;
const DELOAD_FRACTION = 0.9;

export type ProgressionAction = 'increase_weight' | 'maintain' | 'deload' | 'insufficient_data';

export interface ProgressionRecommendation {
  action: ProgressionAction;
  recommendedWeightKg: number;
  targetReps: number;
  confidence: number;
  evidence: string[];
  reasoning: string;
}

function incrementFor(muscleGroup: string): number {
  return LOWER_BODY_GROUPS.has(muscleGroup) ? LOWER_BODY_INCREMENT_KG : UPPER_BODY_INCREMENT_KG;
}

export function calculateProgress(
  sets: PerformedSet[],
  targetReps: number,
  muscleGroup: string
): ProgressionRecommendation {
  if (sets.length < 2) {
    return {
      action: 'insufficient_data',
      recommendedWeightKg: sets[0]?.actualWeight ?? 0,
      targetReps,
      confidence: 0,
      evidence: [],
      reasoning: 'Fewer than 2 logged sessions for this exercise.',
    };
  }

  const lastTwo = sets.slice(-2);
  const lastWeight = sets[sets.length - 1]?.actualWeight ?? 0;
  const metOrBeatTarget = lastTwo.every(set => set.actualReps >= targetReps);
  const failedBadly = lastTwo.every(set => set.actualReps <= targetReps - 3);

  if (metOrBeatTarget) {
    return {
      action: 'increase_weight',
      recommendedWeightKg: lastWeight + incrementFor(muscleGroup),
      targetReps,
      confidence: 0.85,
      evidence: ['last_2_sessions', 'target_reps_met'],
      reasoning: `The last ${lastTwo.length} sessions met or exceeded the ${targetReps}-rep target at ${lastWeight}kg, so load can increase.`,
    };
  }

  if (failedBadly) {
    return {
      action: 'deload',
      recommendedWeightKg: Math.round((lastWeight * DELOAD_FRACTION) / 2.5) * 2.5,
      targetReps,
      confidence: 0.75,
      evidence: ['last_2_sessions', 'target_reps_missed_badly'],
      reasoning: `The last ${lastTwo.length} sessions fell 3+ reps short of the ${targetReps}-rep target, suggesting fatigue or overload.`,
    };
  }

  return {
    action: 'maintain',
    recommendedWeightKg: lastWeight,
    targetReps,
    confidence: 0.6,
    evidence: ['last_2_sessions', 'mixed_performance'],
    reasoning: `Recent performance at ${lastWeight}kg is inconsistent relative to the ${targetReps}-rep target — repeat before changing load.`,
  };
}
