'use client';

import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Metric } from '@/components/ui/Metric';
import { AiLoadingIndicator } from '@/components/AiLoadingIndicator';
import { ChatPanel } from '@/components/ChatPanel';
import { toast } from '@/components/ui/Toast';
import { insightAppear } from '@/lib/motion';
import {
  api,
  DeterministicRecommendation,
  PlateauScanEntry,
  ProgressionRecommendation,
  TodayAdaptation,
  WeekReview,
  WorkoutAnalysis,
} from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  Autorenew,
  AutoAwesome,
  CalendarMonth,
  CheckCircle,
  HelpOutline,
  TrendingDown,
  TrendingFlat,
  TrendingUp,
  Tune,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

type View = 'analysis' | 'why-stuck' | 'week-review' | 'adapt-today';
type LoadState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

const trendCopy: Record<WorkoutAnalysis['overallTrend'], { label: string; icon: ReactNode }> = {
  improving: { label: 'Improving', icon: <TrendingUp fontSize="small" className="text-success" /> },
  steady: { label: 'Steady', icon: <TrendingFlat fontSize="small" className="text-text-secondary" /> },
  declining: { label: 'Declining', icon: <TrendingDown fontSize="small" className="text-danger" /> },
  insufficient_data: {
    label: 'Not enough data yet',
    icon: <TrendingFlat fontSize="small" className="text-text-tertiary" />,
  },
};

const actionCopy: Record<ProgressionRecommendation['action'], { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  increase_weight: { label: 'Increase weight', tone: 'success' },
  maintain: { label: 'Maintain', tone: 'neutral' },
  deload: { label: 'Deload', tone: 'warning' },
  insufficient_data: { label: 'Insufficient data', tone: 'neutral' },
};

function RecommendationCard({ rec }: { rec: ProgressionRecommendation }) {
  const action = actionCopy[rec.action];
  const knowledgeEvidence = rec.evidence.filter(e => e.startsWith('knowledge:'));
  const dataEvidence = rec.evidence.filter(e => !e.startsWith('knowledge:'));

  return (
    <Card className="border-l-2 border-l-accent">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{rec.exercise}</p>
          <Badge tone={action.tone} className="mt-1.5">
            {action.label}
          </Badge>
        </div>
        <Metric value={rec.recommendedWeightKg} unit="kg" size="lg" />
      </div>
      <p className="mt-3 text-sm text-text-secondary">{rec.reasoning}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
        <span>Confidence {Math.round(rec.confidence * 100)}%</span>
        <span>
          Target {rec.targetSets} x {rec.targetReps}
        </span>
      </div>
      {(dataEvidence.length > 0 || knowledgeEvidence.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {dataEvidence.map(e => (
            <span key={e} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-tertiary">
              {e}
            </span>
          ))}
          {knowledgeEvidence.map(e => (
            <span key={e} className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] text-accent">
              {e.replace('knowledge:', '')}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AICoachPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [view, setView] = useState<View>('analysis');
  const [state, setState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null);
  const [plateaus, setPlateaus] = useState<PlateauScanEntry[] | null>(null);
  const [weekReview, setWeekReview] = useState<WeekReview | null>(null);
  const [adaptations, setAdaptations] = useState<TodayAdaptation[] | null>(null);
  const [appliedExercises, setAppliedExercises] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const runAnalysis = async () => {
    setView('analysis');
    setState('loading');
    setErrorMessage(null);
    const response = await api.analyzeWorkout();

    if (response.success && response.data) {
      setAnalysis(response.data.analysis);
      setState('ready');
      return;
    }

    if (response.error?.message?.includes('OPENAI_API_KEY')) {
      setState('unavailable');
      return;
    }

    setErrorMessage(response.error?.message || 'Something went wrong analyzing your training.');
    setState('error');
  };

  const runWhyStuck = async () => {
    setView('why-stuck');
    setState('loading');
    const response = await api.getWhyStuck();
    if (response.success && response.data) {
      setPlateaus(response.data.plateaus);
      setState('ready');
    } else {
      setErrorMessage(response.error?.message || 'Could not check for plateaus.');
      setState('error');
    }
  };

  const runWeekReview = async () => {
    setView('week-review');
    setState('loading');
    const response = await api.getWeekReview();
    if (response.success && response.data) {
      setWeekReview(response.data.review);
      setState('ready');
    } else {
      setErrorMessage(response.error?.message || 'Could not build your week review.');
      setState('error');
    }
  };

  const runAdaptToday = async () => {
    setView('adapt-today');
    setState('loading');
    setAppliedExercises(new Set());
    const response = await api.getTodayAdaptation();
    if (response.success && response.data) {
      setAdaptations(response.data.adaptations);
      setState('ready');
    } else {
      setErrorMessage(response.error?.message || "Could not adapt today's workout.");
      setState('error');
    }
  };

  const applyAdaptation = async (adaptation: TodayAdaptation) => {
    const results = await Promise.all(
      adaptation.setIds.map(setId =>
        api.patch(`/set-records/${setId}`, {
          plannedWeight: adaptation.recommendation.recommendedWeightKg,
          plannedReps: adaptation.recommendation.targetReps,
        })
      )
    );

    if (results.every(r => r.success)) {
      setAppliedExercises(prev => new Set(prev).add(adaptation.exercise));
      toast.success(`${adaptation.exercise} updated for today's workout.`);
    } else {
      toast.error(`Couldn't update ${adaptation.exercise}. Try again.`);
    }
  };

  const retry = { analysis: runAnalysis, 'why-stuck': runWhyStuck, 'week-review': runWeekReview, 'adapt-today': runAdaptToday }[view];

  const actions = [
    { key: 'analysis' as const, label: 'Analyze My Progress', icon: AutoAwesome, onClick: runAnalysis },
    { key: 'plan' as const, label: 'Plan My Week', icon: CalendarMonth, onClick: () => router.push('/plan') },
    { key: 'why-stuck' as const, label: 'Why Am I Stuck?', icon: HelpOutline, onClick: runWhyStuck },
    { key: 'adapt-today' as const, label: 'Adapt Today’s Workout', icon: Tune, onClick: runAdaptToday },
    { key: 'week-review' as const, label: 'Review My Week', icon: Autorenew, onClick: runWeekReview },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-20 md:pb-0">
      <AppHeader title="AI Coach" showWeightToggle={false} />
      <div className="mx-auto max-w-6xl px-4 py-5 pb-24 md:pb-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-text-primary">AI Coach</h1>
          <p className="text-sm text-text-secondary">Your training intelligence.</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {actions.map(action => (
            <button
              key={action.key}
              onClick={action.onClick}
              className="relative flex flex-col items-start gap-2 rounded-lg border border-border-default bg-surface-1 p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <action.icon fontSize="small" className="text-accent" />
              <span className="text-xs font-semibold text-text-primary">{action.label}</span>
            </button>
          ))}
        </div>

        {state === 'idle' && (
          <Card className="flex flex-col items-center gap-4 py-10 text-center">
            <AutoAwesome className="text-accent" fontSize="large" />
            <div>
              <p className="text-base font-semibold text-text-primary">Analyze your training</p>
              <p className="mt-1 max-w-xs text-sm text-text-secondary">
                Your coach reviews your real recent sessions and tells you what to do next -
                grounded in your logged sets, not guesses.
              </p>
            </div>
            <Button onClick={runAnalysis}>Analyze my progress</Button>
          </Card>
        )}

        {state === 'loading' && <AiLoadingIndicator />}

        {state === 'unavailable' && (
          <EmptyState
            icon={<AutoAwesome fontSize="large" />}
            title="AI Coach isn't configured yet"
            description="The training coach needs an OpenAI API key set up on the server before it can analyze your workouts."
          />
        )}

        {state === 'error' && (
          <EmptyState
            title="Something went wrong"
            description={errorMessage ?? undefined}
            action={<Button variant="secondary" onClick={retry}>Try again</Button>}
          />
        )}

        {state === 'ready' && view === 'analysis' && analysis && (
          <motion.div variants={insightAppear} initial="hidden" animate="visible" className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              Recent Insights
            </p>
            <Card>
              <div className="flex items-center gap-2">
                {trendCopy[analysis.overallTrend].icon}
                <span className="text-sm font-medium text-text-secondary">
                  {trendCopy[analysis.overallTrend].label}
                </span>
              </div>
              <p className="mt-2 text-sm text-text-primary">{analysis.summary}</p>
            </Card>

            {analysis.plateauedExercises.length > 0 && (
              <Card>
                <p className="text-sm font-semibold text-text-primary">Plateaued</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.plateauedExercises.map(name => (
                    <Badge key={name} tone="warning">
                      {name}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {analysis.recommendations.length > 0 ? (
              <div className="space-y-3">
                {analysis.recommendations.map(rec => (
                  <RecommendationCard key={rec.exercise} rec={rec} />
                ))}
              </div>
            ) : (
              <EmptyState title="No specific recommendations this time" />
            )}

            <Button variant="secondary" onClick={runAnalysis} className="w-full">
              Re-analyze
            </Button>
          </motion.div>
        )}

        {state === 'ready' && view === 'why-stuck' && plateaus && (
          <motion.div variants={insightAppear} initial="hidden" animate="visible" className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              Why Am I Stuck?
            </p>
            {plateaus.length === 0 ? (
              <EmptyState
                icon={<CheckCircle fontSize="large" className="text-success" />}
                title="Nothing's stuck right now"
                description="None of your recently-trained exercises show a plateau."
              />
            ) : (
              plateaus.map(p => (
                <Card key={p.exercise} className="border-l-2 border-l-warning">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">{p.exercise}</p>
                    <Badge tone="warning">{Math.round(p.confidence * 100)}% confident</Badge>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{p.reasoning}</p>
                </Card>
              ))
            )}
          </motion.div>
        )}

        {state === 'ready' && view === 'week-review' && weekReview && (
          <motion.div variants={insightAppear} initial="hidden" animate="visible" className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              Review My Week
            </p>
            <Card>
              <div className="grid grid-cols-2 gap-4">
                <Metric value={weekReview.sessionsThisWeek} unit="sessions" size="lg" />
                <div>
                  <p className="font-mono text-3xl font-bold text-text-primary">
                    {Math.round(weekReview.volumeThisWeek).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">kg volume</p>
                  {weekReview.volumeChangePct !== null && (
                    <p
                      className={`mt-1 text-xs font-semibold ${weekReview.volumeChangePct >= 0 ? 'text-success' : 'text-danger'}`}
                    >
                      {weekReview.volumeChangePct >= 0 ? '+' : ''}
                      {weekReview.volumeChangePct}% vs last week
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {weekReview.personalRecordsThisWeek.length > 0 && (
              <Card>
                <p className="text-sm font-semibold text-text-primary">Personal records this week</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {weekReview.personalRecordsThisWeek.map(pr => (
                    <Badge key={pr.exercise} tone="success">
                      {pr.exercise}: {pr.weightKg}kg
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {weekReview.plateauedExercises.length > 0 && (
              <Card>
                <p className="text-sm font-semibold text-text-primary">Still plateaued</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {weekReview.plateauedExercises.map(name => (
                    <Badge key={name} tone="warning">
                      {name}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {state === 'ready' && view === 'adapt-today' && adaptations && (
          <motion.div variants={insightAppear} initial="hidden" animate="visible" className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              Adapt Today&apos;s Workout
            </p>
            {adaptations.length === 0 ? (
              <EmptyState
                title="Nothing to adapt"
                description="No workout scheduled today, everything's already logged, or there isn't enough history yet for a recommendation."
              />
            ) : (
              adaptations.map(a => {
                const applied = appliedExercises.has(a.exercise);
                const action = actionCopy[a.recommendation.action];
                return (
                  <Card key={a.exercise} className="border-l-2 border-l-accent">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{a.exercise}</p>
                        <Badge tone={action.tone} className="mt-1.5">
                          {action.label}
                        </Badge>
                      </div>
                      <Metric value={a.recommendation.recommendedWeightKg} unit="kg" size="lg" />
                    </div>
                    <p className="mt-3 text-sm text-text-secondary">{a.recommendation.reasoning}</p>
                    <Button
                      className="mt-3 w-full"
                      variant={applied ? 'secondary' : 'primary'}
                      disabled={applied}
                      onClick={() => applyAdaptation(a)}
                    >
                      {applied ? 'Applied to today’s plan' : "Apply to today's workout"}
                    </Button>
                  </Card>
                );
              })
            )}
          </motion.div>
        )}

        <div className="mt-5">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
