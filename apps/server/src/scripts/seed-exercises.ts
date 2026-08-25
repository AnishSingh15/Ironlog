// Seeds a default exercise catalog. Exercise is a global, shared model (no userId - every
// user sees the same list), and nothing else in the app ever populated one, so a fresh
// database starts completely empty and "Start workout" has nothing to offer. Idempotent:
// uses upsert on the unique `name`, safe to re-run.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DefaultExercise {
  name: string;
  muscleGroup: string;
  defaultSets: number;
  defaultReps: number;
}

const DEFAULT_EXERCISES: DefaultExercise[] = [
  // Chest
  { name: 'Bench Press', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 8 },
  { name: 'Incline Bench Press', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Dumbbell Fly', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 12 },
  { name: 'Push-Up', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 15 },

  // Back
  { name: 'Deadlift', muscleGroup: 'Back', defaultSets: 3, defaultReps: 5 },
  { name: 'Barbell Row', muscleGroup: 'Back', defaultSets: 3, defaultReps: 8 },
  { name: 'Pull-Up', muscleGroup: 'Back', defaultSets: 3, defaultReps: 8 },
  { name: 'Lat Pulldown', muscleGroup: 'Back', defaultSets: 3, defaultReps: 10 },

  // Shoulders
  { name: 'Overhead Press', muscleGroup: 'Shoulders', defaultSets: 3, defaultReps: 8 },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders', defaultSets: 3, defaultReps: 12 },
  { name: 'Face Pull', muscleGroup: 'Shoulders', defaultSets: 3, defaultReps: 15 },

  // Arms
  { name: 'Bicep Curl', muscleGroup: 'Arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Hammer Curl', muscleGroup: 'Arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Tricep Pushdown', muscleGroup: 'Arms', defaultSets: 3, defaultReps: 12 },
  { name: 'Skull Crusher', muscleGroup: 'Arms', defaultSets: 3, defaultReps: 10 },

  // Legs
  { name: 'Squat', muscleGroup: 'Legs', defaultSets: 3, defaultReps: 6 },
  { name: 'Romanian Deadlift', muscleGroup: 'Legs', defaultSets: 3, defaultReps: 8 },
  { name: 'Leg Press', muscleGroup: 'Legs', defaultSets: 3, defaultReps: 10 },
  { name: 'Walking Lunge', muscleGroup: 'Legs', defaultSets: 3, defaultReps: 12 },
  { name: 'Calf Raise', muscleGroup: 'Legs', defaultSets: 3, defaultReps: 15 },

  // Core
  { name: 'Plank', muscleGroup: 'Core', defaultSets: 3, defaultReps: 1 },
  { name: 'Hanging Leg Raise', muscleGroup: 'Core', defaultSets: 3, defaultReps: 12 },
  { name: 'Cable Crunch', muscleGroup: 'Core', defaultSets: 3, defaultReps: 15 },
  { name: 'Russian Twist', muscleGroup: 'Core', defaultSets: 3, defaultReps: 20 },

  // Cardio
  { name: 'Running', muscleGroup: 'Cardio', defaultSets: 1, defaultReps: 1 },
  { name: 'Rowing Machine', muscleGroup: 'Cardio', defaultSets: 1, defaultReps: 1 },
  { name: 'Cycling', muscleGroup: 'Cardio', defaultSets: 1, defaultReps: 1 },
  { name: 'Jump Rope', muscleGroup: 'Cardio', defaultSets: 3, defaultReps: 60 },

  // Full Body
  { name: 'Kettlebell Swing', muscleGroup: 'Full Body', defaultSets: 3, defaultReps: 15 },
  { name: 'Burpee', muscleGroup: 'Full Body', defaultSets: 3, defaultReps: 10 },
  { name: 'Clean and Jerk', muscleGroup: 'Full Body', defaultSets: 3, defaultReps: 3 },
];

async function main() {
  let created = 0;
  for (const exercise of DEFAULT_EXERCISES) {
    const result = await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: {},
      create: exercise,
    });
    if (result) created++;
  }
  console.log(`Seeded ${created} exercises (existing ones left untouched).`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
