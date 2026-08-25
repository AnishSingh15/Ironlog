'use client';

import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Metric } from '@/components/ui/Metric';
import { Skeleton as IlSkeleton } from '@/components/ui/Skeleton';
import { WeightDisplay } from '@/components/WeightComponents';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarToday as CalendarIcon,
  LocalFireDepartment as FireIcon,
  FitnessCenter as FitnessCenterIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { Alert, IconButton, Tooltip } from '@mui/material';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isToday,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SetRecord {
  id: string;
  workoutDayId: string;
  exerciseId: string;
  setIndex: number;
  plannedWeight?: number;
  plannedReps?: number;
  actualWeight: number | null;
  actualReps: number | null;
  secondsRest?: number;
  exercise: {
    name: string;
    muscleGroup: string;
  };
}

interface WorkoutDay {
  id: string;
  userId: string;
  date: string;
  completed: boolean;
  completionPercentage: number;
  splitName: string;
  setRecords: SetRecord[];
}

interface WorkoutStats {
  totalWorkouts: number;
  currentStreak: number;
  totalSetsCompleted: number;
  personalRecords: number;
  recentActivity: Array<{ date: string; completed: boolean }>;
}

export default function HistoryPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadWorkoutHistory();
    loadWorkoutStats();
  }, [isAuthenticated, router, currentMonth]);

  const loadWorkoutHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const response = await api.get(`/workouts/history?startDate=${startDate}&endDate=${endDate}`);
      setWorkoutDays((response.data as any)?.data || response.data);
    } catch (error: any) {
      console.error('Failed to load workout history:', error);
      setError('Failed to load workout history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadWorkoutStats = async () => {
    try {
      const response = await api.get('/workouts/stats');
      setStats((response.data as any)?.data || response.data);
    } catch (error) {
      console.error('Failed to load workout stats:', error);
    }
  };

  const getWorkoutForDate = (date: Date): WorkoutDay | undefined => {
    return workoutDays.find(workout => isSameDay(new Date(workout.date), date));
  };

  // Intensity scale uses the one locked accent at increasing opacity, not a separate
  // green/sage gradient - see DESIGN.md Section 3.
  const getIntensityClass = (workout: WorkoutDay | undefined): string => {
    if (!workout || !workout.setRecords?.length) return 'bg-surface-2';
    const rate = workout.completionPercentage / 100;
    if (rate === 0) return 'bg-surface-2';
    if (rate <= 0.25) return 'bg-accent/25';
    if (rate <= 0.5) return 'bg-accent/45';
    if (rate <= 0.75) return 'bg-accent/70';
    return 'bg-accent';
  };

  const handleDayClick = (date: Date) => {
    const workout = getWorkoutForDate(date);
    setSelectedDay(workout || null);
  };

  const handlePreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

  const renderStatsCards = () => {
    if (!stats) return null;

    const statsData = [
      { title: 'Total workouts', value: stats.totalWorkouts, icon: FitnessCenterIcon },
      { title: 'Current streak', value: `${stats.currentStreak}d`, icon: FireIcon },
      { title: 'Sets completed', value: stats.totalSetsCompleted, icon: TrendingUpIcon },
      { title: 'Personal records', value: stats.personalRecords, icon: TimelineIcon },
    ];

    return (
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statsData.map(stat => (
          <Card key={stat.title} padding="sm" className="text-center">
            <stat.icon className="mx-auto mb-1 text-accent" fontSize="small" />
            <Metric value={stat.value} size="lg" className="items-center" />
            <p className="mt-1 text-xs text-text-tertiary">{stat.title}</p>
          </Card>
        ))}
      </div>
    );
  };

  const renderCalendarHeatmap = () => {
    const startDate = startOfMonth(currentMonth);
    const endDate = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const firstDayOfWeek = startDate.getDay();
    const emptyCells = Array(firstDayOfWeek).fill(null);
    const allCells = [...emptyCells, ...days];

    return (
      <Card className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-accent" fontSize="small" />
            <h2 className="text-base font-semibold text-text-primary">Workout calendar</h2>
          </div>
          <div className="flex items-center gap-1">
            <IconButton onClick={handlePreviousMonth} size="small">
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <p className="min-w-[120px] text-center text-sm font-medium text-text-primary">
              {format(currentMonth, 'MMMM yyyy')}
            </p>
            <IconButton onClick={handleNextMonth} size="small">
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <p key={day} className="pb-1 text-center text-[11px] font-semibold text-text-tertiary">
              {day}
            </p>
          ))}

          {allCells.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="h-10" />;

            const workout = getWorkoutForDate(date);
            const isCurrentDay = isToday(date);

            return (
              <Tooltip
                key={date.toISOString()}
                arrow
                title={
                  workout
                    ? `${format(date, 'MMM dd')}: ${workout.splitName} (${workout.completionPercentage}% complete)`
                    : `${format(date, 'MMM dd')}: No workout`
                }
              >
                <button
                  onClick={() => handleDayClick(date)}
                  className={`flex h-10 items-center justify-center rounded-md text-sm transition-transform hover:scale-105 ${getIntensityClass(workout)} ${
                    isCurrentDay ? 'ring-2 ring-accent' : ''
                  } ${workout && workout.completionPercentage > 50 ? 'text-white' : 'text-text-primary'}`}
                >
                  {format(date, 'd')}
                </button>
              </Tooltip>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          <span className="text-xs text-text-tertiary">Less</span>
          {['bg-surface-2', 'bg-accent/25', 'bg-accent/45', 'bg-accent/70', 'bg-accent'].map(cls => (
            <div key={cls} className={`h-3 w-3 rounded-sm border border-border-default ${cls}`} />
          ))}
          <span className="text-xs text-text-tertiary">More</span>
        </div>
      </Card>
    );
  };

  const renderWorkoutDetails = () => {
    if (!selectedDay) return null;

    return (
      <Card className="mb-4 animate-fade-in">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-base font-semibold text-text-primary">
            {format(new Date(selectedDay.date), 'EEEE, MMMM dd')}
          </p>
          <Badge tone="accent">{selectedDay.splitName}</Badge>
        </div>

        <p className="mb-3 text-sm text-text-secondary">
          {
            selectedDay.setRecords.filter(s => s.actualWeight !== null && s.actualReps !== null)
              .length
          }
          /{selectedDay.setRecords.length} sets completed ({selectedDay.completionPercentage}%)
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {selectedDay.setRecords.map(set => {
            const done = set.actualWeight !== null && set.actualReps !== null;
            return (
              <div
                key={set.id}
                className={
                  done
                    ? 'rounded-lg border border-accent/30 bg-accent/5 p-3'
                    : 'rounded-lg border border-border-default p-3'
                }
              >
                <p className="text-sm font-semibold text-accent">{set.exercise.name}</p>
                <p className="text-xs text-text-tertiary">{set.exercise.muscleGroup}</p>

                {done ? (
                  <div className="mt-1.5">
                    <p className="text-sm font-medium text-text-primary">
                      <WeightDisplay weight={set.actualWeight as number} /> x {set.actualReps} reps
                    </p>
                    {set.plannedWeight != null && set.plannedReps != null && (
                      <p className="text-xs text-text-tertiary">
                        Planned: <WeightDisplay weight={set.plannedWeight} /> x {set.plannedReps} reps
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-1.5">
                    <p className="text-sm text-text-tertiary">Not completed</p>
                    {set.plannedWeight != null && set.plannedReps != null && (
                      <p className="text-xs text-text-tertiary">
                        Planned: {set.plannedWeight}kg x {set.plannedReps} reps
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="History" />

      <div className="mx-auto max-w-4xl px-4 py-5 pb-24 md:pb-6">
        {error && (
          <Alert severity="error" className="!mb-4 !rounded-lg">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <div>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <IlSkeleton key={i} className="h-28 w-full" />
              ))}
            </div>
            <IlSkeleton className="h-96 w-full" />
          </div>
        ) : (
          <>
            {renderStatsCards()}
            {renderCalendarHeatmap()}

            {!selectedDay && workoutDays.length > 0 && (
              <EmptyState
                icon={<CalendarIcon fontSize="large" />}
                title="Click a colored day to view workout details"
                description="Colored squares represent completed workouts."
              />
            )}

            {!selectedDay && workoutDays.length === 0 && (
              <EmptyState
                icon={<FitnessCenterIcon fontSize="large" />}
                title="No workouts this month"
                description="Start your first workout to see your progress here."
                action={<Button onClick={() => router.push('/dashboard')}>Start workout</Button>}
              />
            )}

            {renderWorkoutDetails()}
          </>
        )}
      </div>
    </div>
  );
}
