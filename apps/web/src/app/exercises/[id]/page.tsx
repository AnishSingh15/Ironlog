'use client';

import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { api, ExerciseDetail } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  AutoAwesome as AICoachIcon,
  FitnessCenter as FitnessCenterIcon,
  WarningAmber as PlateauIcon,
} from '@mui/icons-material';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function ExerciseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { isAuthenticated } = useAuthStore();
  const [detail, setDetail] = useState<ExerciseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const load = async () => {
      setIsLoading(true);
      const response = await api.getExercise(params.id);
      if (response.success && response.data) {
        setDetail(response.data);
      } else {
        setNotFound(true);
      }
      setIsLoading(false);
    };

    load();
  }, [isAuthenticated, router, params.id]);

  if (!isAuthenticated) return null;

  const chartData = detail?.history.map(set => ({
    date: new Date(set.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    weight: set.actualWeight,
  }));

  const firstWeight = detail?.history[0]?.actualWeight ?? 0;
  const bestWeight = detail?.personalBest?.actualWeight ?? 0;
  const delta = bestWeight - firstWeight;

  const totalVolume = detail?.history.reduce((sum, s) => sum + s.actualWeight * s.actualReps, 0) ?? 0;
  const totalSets = detail?.history.length ?? 0;
  const avgReps = totalSets > 0 ? (detail!.history.reduce((s, r) => s + r.actualReps, 0) / totalSets) : 0;

  return (
    <div className="min-h-screen bg-canvas pb-20 md:pb-0">
      <AppHeader title={detail?.exercise.name ?? 'Exercise'} showWeightToggle={false} />

      <div className="mx-auto max-w-2xl px-4 py-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : notFound || !detail ? (
          <EmptyState icon={<FitnessCenterIcon fontSize="large" />} title="Exercise not found" />
        ) : (
          <div className="space-y-4">
            <Card padding="lg">
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{detail.exercise.muscleGroup}</Badge>
              </div>
              {detail.personalBest ? (
                <>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-bold text-text-primary">
                      {detail.personalBest.actualWeight}kg
                    </span>
                    <span className="text-sm text-text-secondary">
                      x {detail.personalBest.actualReps} · Personal Record
                    </span>
                  </div>
                  {delta !== 0 && (
                    <p className={`mt-1 font-mono text-sm font-semibold ${delta > 0 ? 'text-success' : 'text-danger'}`}>
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(1)}kg since first logged
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-text-secondary">No sets logged for this exercise yet.</p>
              )}
            </Card>

            {detail.history.length === 0 ? (
              <EmptyState
                icon={<FitnessCenterIcon fontSize="large" />}
                title="No history yet"
                description="Log a set for this exercise during a workout to start building its profile."
              />
            ) : (
              <Tabs defaultValue="overview">
                <TabsList className="w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="stats">Stats</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <h2 className="mb-3 text-sm font-semibold text-text-primary">Progression</h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--il-border)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="#f0453f"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  {detail.plateau && detail.plateau.status !== 'insufficient_data' && (
                    <Card className="border-l-2 border-l-accent">
                      <div className="mb-1 flex items-center gap-2">
                        {detail.plateau.status === 'plateau' ? (
                          <PlateauIcon fontSize="small" className="text-warning" />
                        ) : (
                          <AICoachIcon fontSize="small" className="text-accent" />
                        )}
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                          AI Insight
                        </p>
                      </div>
                      <p className="text-sm text-text-secondary">
                        {detail.plateau.status === 'plateau'
                          ? `This lift has held steady over your last ${detail.plateau.durationSessions} sessions.`
                          : `Trending ${detail.plateau.trend} over your last ${detail.plateau.durationSessions} sessions.`}
                      </p>
                      {detail.recommendation && (
                        <p className="mt-2 text-sm text-text-primary">{detail.recommendation.reasoning}</p>
                      )}
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="history">
                  <Card>
                    <ul className="divide-y divide-border-default">
                      {[...detail.history].reverse().map((set, i) => (
                        <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                          <span className="text-text-secondary">
                            {new Date(set.date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="font-mono font-medium text-text-primary">
                            {set.actualWeight}kg x {set.actualReps}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </TabsContent>

                <TabsContent value="stats">
                  <Card>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="font-mono text-2xl font-bold text-text-primary">{totalSets}</p>
                        <p className="text-xs text-text-tertiary">Total sets</p>
                      </div>
                      <div>
                        <p className="font-mono text-2xl font-bold text-text-primary">
                          {Math.round(totalVolume).toLocaleString()}
                        </p>
                        <p className="text-xs text-text-tertiary">Total volume (kg)</p>
                      </div>
                      <div>
                        <p className="font-mono text-2xl font-bold text-text-primary">
                          {avgReps.toFixed(1)}
                        </p>
                        <p className="text-xs text-text-tertiary">Avg reps/set</p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
