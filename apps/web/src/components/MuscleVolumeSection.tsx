'use client';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWeightUnit } from '@/contexts/WeightUnitContext';
import { api, type MuscleTimeRange, type MuscleVolumeBreakdown } from '@/lib/api';
import { kgToLbs } from '@/lib/weight';
import { MuscleMap, MuscleMapLegend } from '@musclemap/react';
import type { MuscleGroup, MuscleMapValues } from '@musclemap/core';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import { FitnessCenter as EmptyIcon } from '@mui/icons-material';
import { MuscleDetailPanel } from './MuscleDetailPanel';

const RANGES: MuscleTimeRange[] = ['7D', '4W', '8W', '12W', '6M'];

const ACCENT = { light: '#dc2626', dark: '#f0453f' };
const NEUTRAL_BASE = { light: '#d1cfc7', dark: '#3d3d45' };

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function MuscleVolumeSection() {
  const [range, setRange] = useState<MuscleTimeRange>('8W');
  const [mobileView, setMobileView] = useState<'FRONT' | 'BACK'>('FRONT');
  const [breakdown, setBreakdown] = useState<MuscleVolumeBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null);

  const isDesktop = useIsDesktop();
  const { resolvedTheme } = useTheme();
  const { useMetricSystem } = useWeightUnit();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getMuscleVolume(range).then(res => {
      if (cancelled) return;
      if (res.success && res.data) setBreakdown(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const muscles = breakdown?.muscles ?? {};
  const ranked = useMemo(
    () =>
      Object.entries(muscles).sort(([, a], [, b]) => b.volumeKg - a.volumeKg) as [
        MuscleGroup,
        (typeof muscles)[string],
      ][],
    [muscles]
  );

  const values: MuscleMapValues = useMemo(() => {
    const result: MuscleMapValues = {};
    for (const [group, entry] of Object.entries(muscles)) {
      result[group as MuscleGroup] = {
        score: entry.intensity,
        volumeKg: entry.volumeKg,
        sets: entry.sets,
        trend: entry.trendPct == null ? undefined : entry.trendPct > 5 ? 'UP' : entry.trendPct < -5 ? 'DOWN' : 'STABLE',
      };
    }
    return result;
  }, [muscles]);

  useEffect(() => {
    // A previously selected muscle may not have data in the newly fetched range.
    if (selectedGroup && !muscles[selectedGroup]) setSelectedGroup(null);
  }, [muscles, selectedGroup]);

  const formatVolume = (kg: number) => Math.round(useMetricSystem ? kg : kgToLbs(kg)).toLocaleString();
  const unit = useMetricSystem ? 'kg' : 'lbs';

  return (
    <Card>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Muscle Group Volume</h2>
        <div className="inline-flex gap-1 self-start rounded-lg bg-surface-2 p-1">
          {RANGES.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r ? 'bg-surface-1 text-text-primary shadow-[var(--il-shadow-float)]' : 'text-text-secondary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {!loading && ranked.length === 0 ? (
        <EmptyState
          icon={<EmptyIcon fontSize="large" />}
          title="No workouts logged yet"
          description="Log a few workouts to see your volume broken down by muscle."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col items-center gap-4">
            {!isDesktop && (
              <div className="inline-flex gap-1 rounded-lg bg-surface-2 p-1">
                {(['FRONT', 'BACK'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMobileView(v)}
                    className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                      mobileView === v
                        ? 'bg-surface-1 text-text-primary shadow-[var(--il-shadow-float)]'
                        : 'text-text-secondary'
                    }`}
                  >
                    {v === 'FRONT' ? 'Front' : 'Back'}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={`${range}-${isDesktop ? 'BOTH' : mobileView}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MuscleMap
                  values={values}
                  view={isDesktop ? 'BOTH' : mobileView}
                  colorModel="LOAD"
                  monochromeColor={isDark ? ACCENT.dark : ACCENT.light}
                  monochromeBaseColor={isDark ? NEUTRAL_BASE.dark : NEUTRAL_BASE.light}
                  tooltipFields={['group', 'score']}
                  showLegend={false}
                  onSelectMuscle={({ group }) => setSelectedGroup(prev => (prev === group ? null : group))}
                />
              </motion.div>
            </AnimatePresence>

            <MuscleMapLegend
              colorModel="LOAD"
              monochromeColor={isDark ? ACCENT.dark : ACCENT.light}
              monochromeBaseColor={isDark ? NEUTRAL_BASE.dark : NEUTRAL_BASE.light}
              style={{ width: 'min(100%, 320px)' }}
            />
          </div>

          <div className="flex flex-col gap-4">
            <ol className="space-y-1.5" aria-label="Muscle volume ranking">
              {ranked.map(([group, entry], i) => (
                <li key={group}>
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(prev => (prev === group ? null : group))}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2 ${
                      selectedGroup === group ? 'bg-surface-2' : ''
                    }`}
                  >
                    <span className="text-text-secondary">
                      {i + 1}. {group.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-text-primary">
                      {formatVolume(entry.volumeKg)} {unit}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <AnimatePresence>
              {selectedGroup && muscles[selectedGroup] && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-lg border border-border-default bg-surface-2 p-4"
                >
                  <MuscleDetailPanel group={selectedGroup} entry={muscles[selectedGroup]!} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Card>
  );
}
