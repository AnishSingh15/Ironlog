'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useWeightUnit } from '@/contexts/WeightUnitContext';
import type { MuscleVolumeEntry } from '@/lib/api';
import { kgToLbs } from '@/lib/weight';
import { humanizeMuscleGroup } from '@musclemap/react';
import type { MuscleGroup } from '@musclemap/core';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis } from 'recharts';

interface MuscleDetailPanelProps {
  group: MuscleGroup;
  entry: MuscleVolumeEntry;
}

export function MuscleDetailPanel({ group, entry }: MuscleDetailPanelProps) {
  const router = useRouter();
  const { useMetricSystem } = useWeightUnit();
  const unit = useMetricSystem ? 'kg' : 'lbs';
  const displayVolume = Math.round(useMetricSystem ? entry.volumeKg : kgToLbs(entry.volumeKg));

  const trendTone = entry.trendPct == null ? 'neutral' : entry.trendPct >= 0 ? 'success' : 'danger';
  const trendLabel =
    entry.trendPct == null
      ? 'No prior data'
      : `${entry.trendPct >= 0 ? '+' : ''}${entry.trendPct}% vs previous period`;

  const chartData = entry.trendSeries.map(point => ({
    date: new Date(point.bucketStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    volumeKg: point.volumeKg,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold text-text-primary">{humanizeMuscleGroup(group)}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-text-primary">
            {displayVolume.toLocaleString()}
          </span>
          <span className="text-sm text-text-tertiary">{unit}</span>
        </div>
        <Badge tone={trendTone} className="mt-2">
          {trendLabel}
        </Badge>
      </div>

      <div className="flex gap-4 text-sm">
        <div>
          <p className="font-mono font-semibold text-text-primary">{entry.sets}</p>
          <p className="text-xs text-text-tertiary">sets</p>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[0, 'dataMax']} />
              <Area
                type="monotone"
                dataKey="volumeKg"
                stroke="hsl(var(--il-accent))"
                fill="hsl(var(--il-accent) / 0.15)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {entry.topExercises.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">Top exercises</p>
          <ul className="mt-1.5 space-y-1">
            {entry.topExercises.map(name => (
              <li key={name} className="text-sm text-text-secondary">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.topExercises[0] && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(`/exercises?search=${encodeURIComponent(entry.topExercises[0]!)}`)}
        >
          View Exercise History
        </Button>
      )}
    </div>
  );
}
