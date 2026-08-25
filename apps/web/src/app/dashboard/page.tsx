'use client';

import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Metric } from '@/components/ui/Metric';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  AutoAwesome as AICoachIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarMonth as PlanIcon,
  FitnessCenter as WorkoutIcon,
  History as HistoryIcon,
  TrendingUp as ProgressIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TodayWorkout {
  completed: boolean;
  isRestDay: boolean;
  completionPercentage: number;
  splitName: string;
}

interface WorkoutStats {
  totalWorkouts: number;
  currentStreak: number;
  totalSetsCompleted: number;
  personalRecords: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [today, setToday] = useState<TodayWorkout | null>(null);
  const [hasToday, setHasToday] = useState(false);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [weeklySessions, setWeeklySessions] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const load = async () => {
      setIsLoading(true);

      const todayResponse = await api.getTodayWorkout();
      if (todayResponse.success && todayResponse.data) {
        const data = (todayResponse.data as any).data || todayResponse.data;
        setHasToday(true);
        setToday({
          completed: data.workoutDay?.completed ?? false,
          isRestDay: data.workoutDay?.isRestDay ?? false,
          completionPercentage: data.completionPercentage ?? 0,
          splitName: data.splitName ?? '',
        });
      } else {
        setHasToday(false);
      }

      const statsResponse = await api.get('/workouts/stats');
      if (statsResponse.success && statsResponse.data) {
        setStats((statsResponse.data as any).data || (statsResponse.data as any));
      }

      // Fitness state is deterministic aggregation, not an LLM call - safe to load on
      // every Home visit. The AI Coach's actual analysis endpoint is NOT called here;
      // that only runs when the user explicitly asks on the AI Coach page.
      const fitnessResponse = await api.getFitnessState();
      if (fitnessResponse.success && fitnessResponse.data) {
        setWeeklySessions(fitnessResponse.data.trainingFrequency.sessionsPerWeek);
      }

      setIsLoading(false);
    };

    load();
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="Home" />

      <div className="mx-auto max-w-2xl px-4 py-5 pb-24 md:pb-6">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Today */}
            <Card className="border-l-2 border-l-accent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <WorkoutIcon className="text-accent" fontSize="small" />
                  <h2 className="text-base font-semibold text-text-primary">Today</h2>
                </div>
                {hasToday && today?.isRestDay && <Badge tone="neutral">Rest day</Badge>}
                {hasToday && !today?.isRestDay && today?.completed && (
                  <Badge tone="success">Completed</Badge>
                )}
                {hasToday && !today?.isRestDay && !today?.completed && (
                  <Badge tone="accent">{today?.completionPercentage ?? 0}% done</Badge>
                )}
              </div>

              <p className="mt-2 text-sm text-text-secondary">
                {!hasToday && "No workout scheduled yet. Start one when you're ready."}
                {hasToday && today?.isRestDay && 'Recovery day - no training scheduled.'}
                {hasToday &&
                  today &&
                  !today.isRestDay &&
                  today.completed &&
                  `${today.splitName} - all sets logged.`}
                {hasToday &&
                  today &&
                  !today.isRestDay &&
                  !today.completed &&
                  `${today.splitName} in progress.`}
              </p>

              <Button className="mt-3 w-full" onClick={() => router.push('/workout')}>
                {hasToday && today && !today.completed && !today.isRestDay
                  ? 'Continue workout'
                  : hasToday
                    ? 'View workout'
                    : 'Start workout'}
              </Button>
            </Card>

            {/* Consistency */}
            {stats && (
              <Card>
                <h2 className="mb-3 text-base font-semibold text-text-primary">Consistency</h2>
                <div className="grid grid-cols-3 gap-3">
                  <Metric value={stats.currentStreak} unit="day streak" size="lg" />
                  <Metric value={stats.totalWorkouts} unit="workouts" size="lg" />
                  <Metric
                    value={weeklySessions !== null ? weeklySessions.toFixed(1) : '-'}
                    unit="sessions/wk"
                    size="lg"
                  />
                </div>
              </Card>
            )}

            {/* AI Coach teaser */}
            <Card
              className="cursor-pointer border-l-2 border-l-accent transition-colors hover:bg-surface-2"
              onClick={() => router.push('/ai-coach')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AICoachIcon className="text-accent" fontSize="small" />
                  <h2 className="text-base font-semibold text-text-primary">AI Coach</h2>
                </div>
                <ArrowForwardIcon fontSize="small" className="text-text-tertiary" />
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                Get a progression analysis grounded in your actual training history.
              </p>
            </Card>

            {/* Quick links */}
            <div className="grid grid-cols-3 gap-3">
              <Card
                className="cursor-pointer text-center transition-colors hover:bg-surface-2"
                onClick={() => router.push('/plan')}
              >
                <PlanIcon className="mx-auto mb-1 text-text-secondary" fontSize="small" />
                <p className="text-sm font-medium text-text-primary">Plan</p>
              </Card>
              <Card
                className="cursor-pointer text-center transition-colors hover:bg-surface-2"
                onClick={() => router.push('/progress')}
              >
                <ProgressIcon className="mx-auto mb-1 text-text-secondary" fontSize="small" />
                <p className="text-sm font-medium text-text-primary">Progress</p>
              </Card>
              <Card
                className="cursor-pointer text-center transition-colors hover:bg-surface-2"
                onClick={() => router.push('/history')}
              >
                <HistoryIcon className="mx-auto mb-1 text-text-secondary" fontSize="small" />
                <p className="text-sm font-medium text-text-primary">History</p>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
