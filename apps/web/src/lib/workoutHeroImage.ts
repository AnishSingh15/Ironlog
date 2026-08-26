// Today's Workout hero photo, chosen from the day's actual splitName (a sorted
// "MuscleGroup + MuscleGroup" string from workoutService.getSplitName). Order
// matters: legs takes priority since a "Legs + Core" day should still show legs.
const HERO_IMAGES = {
  legs: '/images/hero/legs.png',
  chest: '/images/hero/chest.png',
  back: '/images/hero/back.png',
  armsBack: '/images/hero/arms-back.png',
} as const;

export function getWorkoutHeroImage(splitName: string): string {
  const name = splitName.toLowerCase();
  const hasArms = name.includes('arms');
  const hasBack = name.includes('back');

  if (name.includes('legs')) return HERO_IMAGES.legs;
  if (hasArms && hasBack) return HERO_IMAGES.armsBack;
  if (name.includes('chest')) return HERO_IMAGES.chest;
  if (hasBack) return HERO_IMAGES.back;
  if (hasArms) return HERO_IMAGES.armsBack;
  return HERO_IMAGES.back;
}
