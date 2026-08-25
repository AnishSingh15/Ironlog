'use client';

interface MuscleGroupDiagramProps {
  data: { muscleGroup: string; totalVolume: number }[];
}

// Regions this simplified front-view silhouette can actually shade. "Back" has no
// front-view region (kept in the legend list with its real value, just not shaded here)
// and any other free-text muscle group (Cardio, Full Body, ...) is skipped the same way.
const REGION_BY_GROUP: Record<string, string> = {
  Chest: 'chest',
  Shoulders: 'shoulders',
  Arms: 'arms',
  Core: 'core',
  Legs: 'legs',
};

export function MuscleGroupDiagram({ data }: MuscleGroupDiagramProps) {
  const maxVolume = Math.max(1, ...data.map(d => d.totalVolume));
  const opacityByRegion: Record<string, number> = {};

  for (const { muscleGroup, totalVolume } of data) {
    const region = REGION_BY_GROUP[muscleGroup];
    if (region) {
      opacityByRegion[region] = Math.max(0.12, totalVolume / maxVolume);
    }
  }

  const fill = (region: string) =>
    opacityByRegion[region] !== undefined
      ? `hsl(var(--il-accent) / ${opacityByRegion[region]})`
      : 'hsl(var(--il-border-strong))';

  return (
    <svg viewBox="0 0 120 200" className="h-40 w-auto" aria-hidden="true">
      <circle cx="60" cy="20" r="14" fill="hsl(var(--il-border-strong))" />
      <rect x="30" y="50" width="20" height="55" rx="10" fill={fill('shoulders')} />
      <rect x="70" y="50" width="20" height="55" rx="10" fill={fill('shoulders')} />
      <rect x="42" y="38" width="36" height="60" rx="14" fill={fill('chest')} />
      <rect x="42" y="95" width="36" height="35" rx="12" fill={fill('core')} />
      <rect x="10" y="55" width="16" height="60" rx="8" fill={fill('arms')} />
      <rect x="94" y="55" width="16" height="60" rx="8" fill={fill('arms')} />
      <rect x="44" y="128" width="14" height="62" rx="7" fill={fill('legs')} />
      <rect x="62" y="128" width="14" height="62" rx="7" fill={fill('legs')} />
    </svg>
  );
}
