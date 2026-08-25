import type { PerformedSet } from './analytics.service';

const PLATEAU_WINDOW = 4;
const WEIGHT_FLAT_EPSILON_KG = 0.01;

export type PlateauStatus = 'plateau' | 'progressing' | 'insufficient_data';
export type PlateauTrend = 'flat' | 'upward' | 'downward';

export interface PlateauResult {
  status: PlateauStatus;
  confidence: number;
  durationSessions: number;
  trend: PlateauTrend;
}

export function detectPlateau(sets: PerformedSet[], targetReps: number): PlateauResult {
  if (sets.length < PLATEAU_WINDOW) {
    return { status: 'insufficient_data', confidence: 0, durationSessions: sets.length, trend: 'flat' };
  }

  const window = sets.slice(-PLATEAU_WINDOW);
  const weights = window.map(set => set.actualWeight);
  const firstWeight = weights[0] as number;
  const lastWeight = weights[weights.length - 1] as number;
  const weightSpread = Math.max(...weights) - Math.min(...weights);
  const metTargetEveryTime = window.every(set => set.actualReps >= targetReps);

  if (weightSpread <= WEIGHT_FLAT_EPSILON_KG) {
    return {
      status: metTargetEveryTime ? 'progressing' : 'plateau',
      confidence: 0.8,
      durationSessions: window.length,
      trend: 'flat',
    };
  }

  const trend: PlateauTrend = lastWeight > firstWeight ? 'upward' : 'downward';

  return {
    status: trend === 'upward' ? 'progressing' : 'plateau',
    confidence: 0.7,
    durationSessions: window.length,
    trend,
  };
}
