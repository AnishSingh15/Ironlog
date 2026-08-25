'use client';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton as IlSkeleton } from '@/components/ui/Skeleton';
import { WeightDisplay } from '@/components/WeightComponents';
import { useWeightUnit } from '@/contexts/WeightUnitContext';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { BarChart as BarChartIcon, FilterList as FilterIcon, Sort as SortIcon } from '@mui/icons-material';
import {
  Alert,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

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

// Desaturated categorical palette (accent + neutrals) for the muscle-group pie chart -
// no rainbow, no reused old-palette hues. See DESIGN.md Section 8.
const chartColors = ['#2F6FED', '#8a8a92', '#5B8DFF', '#c4c4ca', '#3a3a42'];

export default function ProgressPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { useMetricSystem } = useWeightUnit();

  const [exerciseStats, setExerciseStats] = useState<ExerciseStats[]>([]);
  const [volumeData, setVolumeData] = useState<VolumeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);

      const response = await api.get('/set-records');
      const responseData = response.data as any;
      const records: SetRecord[] = (responseData.data || responseData).filter(
        (record: SetRecord) => record.actualWeight && record.actualReps
      );

      calculateExerciseStats(records);
      calculateVolumeData(records);
    } catch (error: any) {
      console.error('Failed to load progress data:', error);
      setError('Failed to load progress data. Please try again.');
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
        {error && (
          <Alert severity="error" className="!mb-4 !rounded-lg">
            {error}
          </Alert>
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
                  <Bar dataKey="volume" fill="#2F6FED" radius={[4, 4, 0, 0]} />
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
            <TableContainer className="max-h-[600px]">
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Exercise</TableCell>
                    <TableCell>Muscle group</TableCell>
                    <TableCell align="center">Best set</TableCell>
                    <TableCell align="center">1-rep max</TableCell>
                    <TableCell align="center">Total volume</TableCell>
                    <TableCell align="center">Sets</TableCell>
                    <TableCell align="center">Progression</TableCell>
                    <TableCell align="center">Last performed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAndSortedStats.map(stat => (
                    <TableRow key={stat.exerciseName} hover>
                      <TableCell className="!font-semibold">{stat.exerciseName}</TableCell>
                      <TableCell>
                        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-secondary">
                          {stat.muscleGroup}
                        </span>
                      </TableCell>
                      <TableCell align="center" className="!font-mono">
                        <WeightDisplay weight={stat.bestSet.weight} /> x {stat.bestSet.reps}
                      </TableCell>
                      <TableCell align="center" className="!font-mono !font-semibold">
                        <WeightDisplay weight={stat.bestSet.oneRM} />
                      </TableCell>
                      <TableCell align="center" className="!font-mono">
                        <WeightDisplay weight={Math.round(stat.totalVolume)} />
                      </TableCell>
                      <TableCell align="center" className="!font-mono">
                        {stat.totalSets}
                      </TableCell>
                      <TableCell align="center">
                        <span className={`font-mono font-semibold ${progressionClass(stat.progression)}`}>
                          {stat.progression > 0 ? '+' : ''}
                          {stat.progression.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell align="center" className="!text-text-tertiary">
                        {formatDate(stat.lastPerformed)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
