'use client';

import { AnimatedMetric } from '@/components/AnimatedMetric';
import { AppHeader } from '@/components/AppHeader';
import { MuscleVolumeSection } from '@/components/MuscleVolumeSection';
import { WeekCalendarStrip } from '@/components/WeekCalendarStrip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, FitnessStateSnapshot, PersonalRecord, WeekCalendarDay } from '@/lib/api';
import { fadeSlideUp, insightAppear } from '@/lib/motion';
import { useAuthStore } from '@/store/auth';
import {
  AutoAwesome as AICoachIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarMonth as PlanIcon,
  FitnessCenter as WorkoutIcon,
  History as HistoryIcon,
  LocalFireDepartment as StreakIcon,
  TrendingUp as ProgressIcon,
  WarningAmber as PlateauIcon,
} from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TodayWorkout {
  completed: boolean;
  isRestDay: boolean;
  completionPercentage: number;
  splitName: string;
  exerciseNames: string[];
}

interface WorkoutStats {
  totalWorkouts: number;
  currentStreak: number;
  totalSetsCompleted: number;
  personalRecords: PersonalRecord[];
}

interface RecentActivityDay {
  id: string;
  date: string;
  completed: boolean;
  isRestDay: boolean;
  splitName: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [today, setToday] = useState<TodayWorkout | null>(null);
  const [hasToday, setHasToday] = useState(false);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [fitnessState, setFitnessState] = useState<FitnessStateSnapshot | null>(null);
  const [weekCalendar, setWeekCalendar] = useState<WeekCalendarDay[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityDay[]>([]);
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
        const exerciseNames: string[] = Array.from(
          new Set((data.workoutDay?.setRecords ?? []).map((s: any) => s.exercise.name as string))
        );
        setHasToday(true);
        setToday({
          completed: data.workoutDay?.completed ?? false,
          isRestDay: data.workoutDay?.isRestDay ?? false,
          completionPercentage: data.completionPercentage ?? 0,
          splitName: data.splitName ?? '',
          exerciseNames,
        });
      } else {
        setHasToday(false);
      }

      const statsResponse = await api.get<WorkoutStats>('/workouts/stats');
      if (statsResponse.success && statsResponse.data) {
        setStats((statsResponse.data as any).data || statsResponse.data);
      }

      // Fitness state (frequency, volume, muscle groups, consistency, plateau scan) is all
      // deterministic aggregation - safe to load on every Home visit. The AI Coach's actual
      // LLM analysis endpoint is NOT called here; that only runs when the user explicitly
      // asks on the AI Coach page.
      const fitnessResponse = await api.getFitnessState();
      if (fitnessResponse.success && fitnessResponse.data) {
        setFitnessState(fitnessResponse.data);
      }

      const calendarResponse = await api.getWeekCalendar();
      if (calendarResponse.success && calendarResponse.data) {
        setWeekCalendar(calendarResponse.data.days);
      }

      const historyResponse = await api.get<RecentActivityDay[]>('/workouts/history');
      if (historyResponse.success && historyResponse.data) {
        const days = (historyResponse.data as any).data || historyResponse.data;
        setRecentActivity(days.slice(0, 5));
      }

      setIsLoading(false);
    };

    load();
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const firstName = user?.name?.split(' ')[0];
  const topPR = stats?.personalRecords?.length
    ? [...stats.personalRecords].sort((a, b) => b.weightKg - a.weightKg)[0]
    : null;
  const latestWeeklyVolume = fitnessState?.weeklyVolume?.length
    ? fitnessState.weeklyVolume[fitnessState.weeklyVolume.length - 1].totalVolume
    : 0;

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="Home" />

      <div className="mx-auto max-w-6xl px-4 py-5 pb-24 md:pb-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-text-primary" data-testid="welcome-message">
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </h1>
          {stats && stats.currentStreak > 0 && (
            <Badge tone="accent" className="gap-1">
              <StreakIcon sx={{ fontSize: 14 }} />
              {stats.currentStreak} day streak
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Today + AI Coach Insight */}
            <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
              <Card
                padding="lg"
                className="relative overflow-hidden border-none bg-gradient-to-br from-surface-3 via-surface-1 to-accent/15 text-text-primary"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(var(--il-accent)/0.25),_transparent_60%)]" />
                <div className="relative">
                  <div className="mb-1 flex items-center gap-2">
                    <WorkoutIcon className="text-accent" fontSize="small" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                      Today's Workout
                    </span>
                  </div>

                  {!hasToday && (
                    <>
                      <p className="mb-4 text-lg font-semibold text-text-primary">
                        No workout scheduled yet
                      </p>
                      <p className="mb-4 text-sm text-text-secondary">
                        Start one when you're ready.
                      </p>
                    </>
                  )}

                  {hasToday && today?.isRestDay && (
                    <>
                      <p className="mb-1 text-2xl font-bold text-text-primary">Rest Day</p>
                      <p className="mb-4 text-sm text-text-secondary">
                        Recovery day - no training scheduled.
                      </p>
                    </>
                  )}

                  {hasToday && today && !today.isRestDay && (
                    <>
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-2xl font-bold text-text-primary">{today.splitName}</p>
                        {today.completed && <Badge tone="success">Completed</Badge>}
                        {!today.completed && (
                          <Badge tone="accent">{today.completionPercentage}% done</Badge>
                        )}
                      </div>
                      <p className="mb-4 font-mono text-sm text-text-secondary">
                        {today.exerciseNames.join(' · ')}
                      </p>
                    </>
                  )}

                  <Button className="w-full md:w-auto" onClick={() => router.push('/workout')}>
                    {hasToday && today && !today.completed && !today.isRestDay
                      ? 'Continue workout'
                      : hasToday
                        ? 'View workout'
                        : 'Start workout'}
                  </Button>
                </div>
              </Card>

              <AnimatePresence mode="wait">
                <motion.div
                  key={fitnessState?.plateauAlert ? 'alert' : 'clear'}
                  variants={insightAppear}
                  initial="hidden"
                  animate="visible"
                >
                  <Card
                    padding="lg"
                    className="h-full cursor-pointer border-l-2 border-l-accent transition-colors hover:bg-surface-2"
                    onClick={() => router.push('/ai-coach')}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AICoachIcon className="text-accent" fontSize="small" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                          AI Coach Insight
                        </span>
                      </div>
                      <ArrowForwardIcon fontSize="small" className="text-text-tertiary" />
                    </div>

                    {fitnessState?.plateauAlert ? (
                      <>
                        <Badge tone="warning" className="mb-2 gap-1">
                          <PlateauIcon sx={{ fontSize: 12 }} />
                          Plateau detected
                        </Badge>
                        <p className="text-sm text-text-secondary">
                          Your {fitnessState.plateauAlert.exercise} has held steady over the last{' '}
                          {fitnessState.plateauAlert.durationSessions} sessions.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        No plateaus detected in your recent lifts - keep it up. Ask the AI Coach
                        for a full progression analysis anytime.
                      </p>
                    )}
                  </Card>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Training Snapshot */}
            <Card>
              <SectionHeader title="Training Snapshot" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <AnimatedMetric
                    value={fitnessState?.consistencyScore ?? 0}
                    suffix="%"
                    className="font-mono text-3xl font-bold text-text-primary"
                  />
                  <p className="mt-1 text-xs text-text-tertiary">Consistency</p>
                </div>
                <div>
                  <p className="font-mono text-3xl font-bold text-text-primary">
                    {topPR ? topPR.weightKg : '-'}
                    {topPR && <span className="ml-1 text-base text-text-tertiary">kg</span>}
                  </p>
                  <p className="mt-1 truncate text-xs text-text-tertiary">
                    {topPR ? `${topPR.exercise} PR` : 'No PRs yet'}
                  </p>
                </div>
                <div>
                  <AnimatedMetric
                    value={latestWeeklyVolume}
                    className="font-mono text-3xl font-bold text-text-primary"
                  />
                  <p className="mt-1 text-xs text-text-tertiary">Weekly volume (kg)</p>
                </div>
                <div>
                  <AnimatedMetric
                    value={fitnessState?.trainingFrequency.totalSessions ?? 0}
                    className="font-mono text-3xl font-bold text-text-primary"
                  />
                  <p className="mt-1 text-xs text-text-tertiary">Sessions (8wk)</p>
                </div>
              </div>
            </Card>

            {/* Weekly Calendar / Progress */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <SectionHeader title="Weekly Calendar" />
                {weekCalendar.length > 0 ? (
                  <WeekCalendarStrip days={weekCalendar} />
                ) : (
                  <Skeleton className="h-24 w-full" />
                )}
              </Card>

              <Card>
                <SectionHeader
                  title="Progress"
                  action={
                    <button
                      onClick={() => router.push('/progress')}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      View all
                    </button>
                  }
                />
                {fitnessState?.weeklyVolume?.length ? (
                  <div className="flex h-24 items-end gap-1">
                    {fitnessState.weeklyVolume.slice(-8).map((week, i) => {
                      const max = Math.max(...fitnessState.weeklyVolume.map(w => w.totalVolume), 1);
                      const heightPct = Math.max(4, (week.totalVolume / max) * 100);
                      return (
                        <motion.div
                          key={week.weekStart}
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPct}%` }}
                          transition={{ delay: i * 0.03 }}
                          className="flex-1 rounded-t bg-accent/70"
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-text-tertiary">No volume logged yet this window.</p>
                )}
              </Card>
            </div>

            <MuscleVolumeSection />

            {/* Recent Activity */}
            <Card>
              <SectionHeader title="Recent Activity" />
              {recentActivity.length === 0 ? (
                <p className="text-sm text-text-tertiary">No workouts logged yet.</p>
              ) : (
                <ul className="divide-y divide-border-default">
                  {recentActivity.map(day => (
                    <li key={day.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            day.isRestDay
                              ? 'bg-text-tertiary'
                              : day.completed
                                ? 'bg-success'
                                : 'bg-border-strong'
                          }`}
                        />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {day.isRestDay ? 'Rest Day' : day.splitName}
                          </p>
                          <p className="font-mono text-xs text-text-tertiary">
                            {new Date(day.date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      {!day.isRestDay && (
                        <Badge tone={day.completed ? 'success' : 'neutral'}>
                          {day.completed ? 'Completed' : 'Incomplete'}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Quick links */}
            <motion.div
              variants={fadeSlideUp}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-3 gap-3"
            >
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
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
