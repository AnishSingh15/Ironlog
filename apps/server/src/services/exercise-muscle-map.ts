// Mirrors @musclemap/core's MuscleGroup union exactly (packages/core/src/types.ts in
// github.com/Jsplice/MuscleMap) - hand-rolled here rather than imported so the server
// doesn't take a dependency on a frontend-oriented, ESM-only npm package just for one type.
export type MuscleGroup =
  | 'CHEST'
  | 'BACK_UPPER'
  | 'BACK_LOWER'
  | 'TRAPEZIUS'
  | 'RHOMBOIDS'
  | 'LATS'
  | 'SHOULDERS_FRONT'
  | 'SHOULDERS_SIDE'
  | 'SHOULDERS_REAR'
  | 'BICEPS'
  | 'TRICEPS'
  | 'FOREARMS'
  | 'CORE'
  | 'OBLIQUES'
  | 'GLUTES'
  | 'QUADS'
  | 'HAMSTRINGS'
  | 'CALVES'
  | 'HIP_FLEXORS'
  | 'ADDUCTORS'
  | 'ABDUCTORS';

export const MUSCLE_WEIGHTS = { primary: 1.0, secondary: 0.5 } as const;
// A secondary/assisting muscle does real work but less than the prime mover.
// Half credit avoids both undercounting it (0) and double-counting it at full
// value across every compound lift that happens to touch it.

interface MuscleContribution {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
}

export const EXERCISE_MUSCLE_MAP: Record<string, MuscleContribution> = {
  'Bench Press': { primary: ['CHEST'], secondary: ['SHOULDERS_FRONT', 'TRICEPS'] },
  'Incline Bench Press': { primary: ['CHEST'], secondary: ['SHOULDERS_FRONT', 'TRICEPS'] },
  'Dumbbell Fly': { primary: ['CHEST'], secondary: ['SHOULDERS_FRONT'] },
  'Push-Up': { primary: ['CHEST'], secondary: ['SHOULDERS_FRONT', 'TRICEPS', 'CORE'] },
  Deadlift: { primary: ['BACK_LOWER', 'GLUTES', 'HAMSTRINGS'], secondary: ['TRAPEZIUS', 'FOREARMS'] },
  'Barbell Row': { primary: ['LATS', 'RHOMBOIDS'], secondary: ['BICEPS', 'SHOULDERS_REAR'] },
  'Pull-Up': { primary: ['LATS'], secondary: ['BICEPS', 'RHOMBOIDS', 'FOREARMS'] },
  'Lat Pulldown': { primary: ['LATS'], secondary: ['BICEPS', 'RHOMBOIDS'] },
  'Overhead Press': { primary: ['SHOULDERS_FRONT'], secondary: ['TRICEPS', 'TRAPEZIUS'] },
  'Lateral Raise': { primary: ['SHOULDERS_SIDE'], secondary: [] },
  'Face Pull': { primary: ['SHOULDERS_REAR'], secondary: ['TRAPEZIUS', 'RHOMBOIDS'] },
  'Bicep Curl': { primary: ['BICEPS'], secondary: [] },
  'Hammer Curl': { primary: ['BICEPS'], secondary: ['FOREARMS'] },
  'Tricep Pushdown': { primary: ['TRICEPS'], secondary: [] },
  'Skull Crusher': { primary: ['TRICEPS'], secondary: [] },
  Squat: { primary: ['QUADS', 'GLUTES'], secondary: ['HAMSTRINGS', 'CORE', 'ADDUCTORS'] },
  'Romanian Deadlift': { primary: ['HAMSTRINGS', 'GLUTES'], secondary: ['BACK_LOWER'] },
  'Leg Press': { primary: ['QUADS'], secondary: ['GLUTES', 'HAMSTRINGS'] },
  'Walking Lunge': { primary: ['QUADS', 'GLUTES'], secondary: ['HAMSTRINGS', 'ADDUCTORS'] },
  'Calf Raise': { primary: ['CALVES'], secondary: [] },
  Plank: { primary: ['CORE'], secondary: ['OBLIQUES'] },
  'Hanging Leg Raise': { primary: ['CORE', 'HIP_FLEXORS'], secondary: [] },
  'Cable Crunch': { primary: ['CORE'], secondary: [] },
  'Russian Twist': { primary: ['OBLIQUES'], secondary: ['CORE'] },
  'Kettlebell Swing': { primary: ['GLUTES', 'HAMSTRINGS'], secondary: ['BACK_LOWER', 'SHOULDERS_FRONT', 'CORE'] },
  Burpee: { primary: ['QUADS', 'GLUTES', 'CORE'], secondary: ['CHEST', 'SHOULDERS_FRONT'] },
  'Clean and Jerk': {
    primary: ['QUADS', 'GLUTES', 'TRAPEZIUS', 'SHOULDERS_FRONT'],
    secondary: ['HAMSTRINGS', 'TRICEPS', 'CORE'],
  },
  // Running, Rowing Machine, Cycling, Jump Rope: deliberately excluded. "volume =
  // weight x reps" doesn't meaningfully describe cardio work, so they contribute
  // no muscle load rather than a made-up number.
};

// Fallback for user-created custom exercises not covered above: use the
// exercise's own broad `Exercise.muscleGroup` category as a single primary group.
// Cardio and Full Body have no single sensible group and are left unmapped.
export const FALLBACK_BY_BROAD_GROUP: Partial<Record<string, MuscleGroup>> = {
  Chest: 'CHEST',
  Back: 'LATS',
  Shoulders: 'SHOULDERS_FRONT',
  Arms: 'BICEPS',
  Legs: 'QUADS',
  Core: 'CORE',
};

export interface MuscleContributionEntry {
  group: MuscleGroup;
  weight: number;
}

export function getMuscleContributions(exerciseName: string, broadMuscleGroup: string): MuscleContributionEntry[] {
  const explicit = EXERCISE_MUSCLE_MAP[exerciseName];
  if (explicit) {
    return [
      ...explicit.primary.map(group => ({ group, weight: MUSCLE_WEIGHTS.primary })),
      ...explicit.secondary.map(group => ({ group, weight: MUSCLE_WEIGHTS.secondary })),
    ];
  }

  const fallback = FALLBACK_BY_BROAD_GROUP[broadMuscleGroup];
  return fallback ? [{ group: fallback, weight: MUSCLE_WEIGHTS.primary }] : [];
}
