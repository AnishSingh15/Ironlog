'use client';

import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton as IlSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { WeightDisplay } from '@/components/WeightComponents';
import { useWeightUnit } from '@/contexts/WeightUnitContext';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  AutoAwesome as AICoachIcon,
  BarChart as BarChartIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// The accent + a desaturated neutral ladder, matching the v2 Iron Red token system -
// no rainbow, no leftover Signal Blue hex from v1. See DESIGN.md Section 3/8.
const chartColors = ['#f0453f', '#8a8a92', '#f4756f', '#c4c4ca', '#3a3a42'];

interface SetRecord {
  id: string;
  actualWeight: number;
  actualReps: number;
  exercise: {
    id: string;
    name: string;
    muscleGroup: string;
  };
  workoutDay: {
    date: string;
  };
}

interface ExerciseStats {
  exerciseName: string;
  muscleGroup: string;
  bestSet: {
    weight: number;
    reps: number;
    oneRM: number;
  };
  totalVolume: number;
  avgVolume: number;
  totalSets: number;
  lastPerformed: string;
  progression: number;
}

interface VolumeData {
  muscleGroup: string;
  volume: number;
  sets: number;
}

export default function ProgressPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { useMetricSystem } = useWeightUnit();

  const [exerciseStats, setExerciseStats] = useState<ExerciseStats[]>([]);
  const [volumeData, setVolumeData] = useState<VolumeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [muscleGroupFilter, setMuscleGroupFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'oneRM' | 'volume' | 'lastPerformed'>('oneRM');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const muscleGroups = ['all', ...new Set(exerciseStats.map(stat => stat.muscleGroup))];

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadProgressData();
  }, [isAuthenticated, router]);

  const loadProgressData = async () => {
    try {
      setIsLoading(true);

      const response = await api.get('/set-records');
      const responseData = response.data as any;
      const records: SetRecord[] = (responseData.data || responseData).filter(
        (record: SetRecord) => record.actualWeight && record.actualReps
      );

      calculateExerciseStats(records);
      calculateVolumeData(records);
    } catch (error: any) {
      console.error('Failed to load progress data:', error);
      toast.error('Failed to load progress data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateExerciseStats = (records: SetRecord[]) => {
    const exerciseMap = new Map<string, ExerciseStats>();

    records.forEach(record => {
      const { exercise } = record;
      const oneRM = calculateOneRM(record.actualWeight, record.actualReps);
      const volume = record.actualWeight * record.actualReps;

      if (!exerciseMap.has(exercise.id)) {
        exerciseMap.set(exercise.id, {
          exerciseName: exercise.name,
          muscleGroup: exercise.muscleGroup,
          bestSet: { weight: record.actualWeight, reps: record.actualReps, oneRM },
          totalVolume: volume,
          avgVolume: volume,
          totalSets: 1,
          lastPerformed: record.workoutDay.date,
          progression: 0,
        });
      } else {
        const stats = exerciseMap.get(exercise.id)!;

        if (oneRM > stats.bestSet.oneRM) {
          stats.bestSet = { weight: record.actualWeight, reps: record.actualReps, oneRM };
        }

        stats.totalVolume += volume;
        stats.totalSets += 1;
        stats.avgVolume = stats.totalVolume / stats.totalSets;

        if (new Date(record.workoutDay.date) > new Date(stats.lastPerformed)) {
          stats.lastPerformed = record.workoutDay.date;
        }
      }
    });

    exerciseMap.forEach((stats, exerciseId) => {
      const exerciseRecords = records
        .filter(r => r.exercise.id === exerciseId)
        .sort(
          (a, b) => new Date(a.workoutDay.date).getTime() - new Date(b.workoutDay.date).getTime()
        );

      if (exerciseRecords.length > 1) {
        const firstRecord = exerciseRecords[0];
        const lastRecord = exerciseRecords[exerciseRecords.length - 1];
        const firstOneRM = calculateOneRM(firstRecord.actualWeight, firstRecord.actualReps);
        const lastOneRM = calculateOneRM(lastRecord.actualWeight, lastRecord.actualReps);
        stats.progression = ((lastOneRM - firstOneRM) / firstOneRM) * 100;
      }
    });

    setExerciseStats(Array.from(exerciseMap.values()));
  };

  const calculateVolumeData = (records: SetRecord[]) => {
    const volumeMap = new Map<string, { volume: number; sets: number }>();

    records.forEach(record => {
      const { muscleGroup } = record.exercise;
      const volume = record.actualWeight * record.actualReps;

      if (!volumeMap.has(muscleGroup)) {
        volumeMap.set(muscleGroup, { volume, sets: 1 });
      } else {
        const data = volumeMap.get(muscleGroup)!;
        data.volume += volume;
        data.sets += 1;
      }
    });

    setVolumeData(
      Array.from(volumeMap.entries()).map(([muscleGroup, data]) => ({
        muscleGroup,
        volume: data.volume,
        sets: data.sets,
      }))
    );
  };

  const calculateOneRM = (weight: number, reps: number): number => {
    return Math.round(weight * (1 + reps / 30));
  };

  const filteredAndSortedStats = exerciseStats
    .filter(stat => muscleGroupFilter === 'all' || stat.muscleGroup === muscleGroupFilter)
    .sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortBy) {
        case 'oneRM':
          aValue = a.bestSet.oneRM;
          bValue = b.bestSet.oneRM;
          break;
        case 'volume':
          aValue = a.totalVolume;
          bValue = b.totalVolume;
          break;
        case 'lastPerformed':
          aValue = new Date(a.lastPerformed).getTime();
          bValue = new Date(b.lastPerformed).getTime();
          break;
        default:
          return 0;
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

  const topByOneRM = exerciseStats.length
    ? [...exerciseStats].sort((a, b) => b.bestSet.oneRM - a.bestSet.oneRM)[0]
    : null;
  const biggestMover = exerciseStats.length
    ? [...exerciseStats].sort((a, b) => b.progression - a.progression)[0]
    : null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const progressionClass = (progression: number) => {
    if (progression > 0) return 'text-success';
    if (progression < 0) return 'text-danger';
    return 'text-text-secondary';
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="Progress" />

      <div className="mx-auto max-w-5xl px-4 py-5 pb-24 md:pb-6">
        {!isLoading && topByOneRM && (
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <Card padding="lg">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Current Best
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold text-text-primary">
                  <WeightDisplay weight={topByOneRM.bestSet.oneRM} />
                </span>
                <span className="text-sm text-text-secondary">{topByOneRM.exerciseName} est. 1RM</span>
              </div>
              {topByOneRM.progression !== 0 && (
                <p className={`mt-1 font-mono text-sm font-semibold ${progressionClass(topByOneRM.progression)}`}>
                  {topByOneRM.progression > 0 ? '+' : ''}
                  {topByOneRM.progression.toFixed(1)}% this window
                </p>
              )}
            </Card>

            <Card padding="lg" className="border-l-2 border-l-accent">
              <div className="mb-1 flex items-center gap-2">
                <AICoachIcon className="text-accent" fontSize="small" />
                <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  AI Analysis
                </p>
              </div>
              {biggestMover && biggestMover.progression > 0 ? (
                <p className="text-sm text-text-secondary">
                  Your <span className="font-semibold text-text-primary">{biggestMover.exerciseName}</span>{' '}
                  has improved the most this window: an estimated{' '}
                  <span className="font-mono font-semibold text-success">
                    +{biggestMover.progression.toFixed(1)}%
                  </span>{' '}
                  in 1-rep max.
                </p>
              ) : (
                <p className="text-sm text-text-secondary">
                  Not enough repeated sessions per exercise yet to detect a trend. Keep logging to
                  unlock this.
                </p>
              )}
            </Card>
          </div>
        )}

        <Card className="mb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormControl fullWidth size="small">
              <InputLabel>Muscle Group</InputLabel>
              <Select
                value={muscleGroupFilter}
                label="Muscle Group"
                onChange={e => setMuscleGroupFilter(e.target.value)}
                startAdornment={<FilterIcon fontSize="small" className="mr-1 text-text-tertiary" />}
              >
                {muscleGroups.map(group => (
                  <MenuItem key={group} value={group}>
                    {group === 'all' ? 'All muscle groups' : group}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                label="Sort by"
                onChange={e => setSortBy(e.target.value as any)}
                startAdornment={<SortIcon fontSize="small" className="mr-1 text-text-tertiary" />}
              >
                <MenuItem value="oneRM">1-rep max</MenuItem>
                <MenuItem value="volume">Total volume</MenuItem>
                <MenuItem value="lastPerformed">Last performed</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="secondary"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              <SortIcon fontSize="small" />
              {sortOrder === 'desc' ? 'Descending' : 'Ascending'}
            </Button>
          </div>
        </Card>

        {!isLoading && volumeData.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <h2 className="mb-3 text-base font-semibold text-text-primary">
                Volume by muscle group
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--il-border)" />
                  <XAxis dataKey="muscleGroup" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      name === 'volume' ? `${value} ${useMetricSystem ? 'kg' : 'lbs'}` : value,
                      name === 'volume' ? 'Total volume' : 'Total sets',
                    ]}
                  />
                  <Bar dataKey="volume" fill="#f0453f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-semibold text-text-primary">Sets distribution</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={volumeData}
                    dataKey="sets"
                    nameKey="muscleGroup"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ muscleGroup, percent }: any) =>
                      `${muscleGroup}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {volumeData.map((entry, index) => (
                      <Cell key={index} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        <Card>
          <h2 className="mb-3 text-base font-semibold text-text-primary">
            Personal records &amp; performance
          </h2>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(5)].map((_, i) => (
                <IlSkeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredAndSortedStats.length === 0 ? (
            <EmptyState
              icon={<BarChartIcon fontSize="large" />}
              title="No progress data yet"
              description="Complete some workouts to see your progress stats."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border-default">
              {filteredAndSortedStats.map(stat => (
                <div
                  key={stat.exerciseName}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-primary">{stat.exerciseName}</p>
                      <Badge>{stat.muscleGroup}</Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-text-tertiary">
                      Best: <WeightDisplay weight={stat.bestSet.weight} /> x {stat.bestSet.reps} ·{' '}
                      {stat.totalSets} sets · {formatDate(stat.lastPerformed)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:justify-end">
                    <div className="text-right">
                      <p className="font-mono text-lg font-bold text-text-primary">
                        <WeightDisplay weight={stat.bestSet.oneRM} />
                      </p>
                      <p className="text-[11px] text-text-tertiary">est. 1RM</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm font-semibold ${progressionClass(stat.progression)}`}>
                        {stat.progression > 0 ? '+' : ''}
                        {stat.progression.toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        <WeightDisplay weight={Math.round(stat.totalVolume)} /> vol
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
