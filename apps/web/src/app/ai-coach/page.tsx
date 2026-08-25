'use client';

import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Metric } from '@/components/ui/Metric';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, ProgressionRecommendation, WorkoutAnalysis } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AutoAwesome, TrendingDown, TrendingFlat, TrendingUp } from '@mui/icons-material';
import { Container } from '@mui/material';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

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
  const [state, setState] = useState<LoadState>('idle');
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const runAnalysis = async () => {
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

  return (
    <div className="min-h-screen bg-canvas pb-20 md:pb-0">
      <AppHeader title="AI Coach" showWeightToggle={false} />
      <Container maxWidth="sm" className="!px-4 !py-6">
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

        {state === 'loading' && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {state === 'unavailable' && (
          <EmptyState
            icon={<AutoAwesome fontSize="large" />}
            title="AI Coach isn't configured yet"
            description="The training coach needs an OpenAI API key set up on the server before it can analyze your workouts."
          />
        )}

        {state === 'error' && (
          <EmptyState
            title="Couldn't analyze your training"
            description={errorMessage ?? undefined}
            action={<Button variant="secondary" onClick={runAnalysis}>Try again</Button>}
          />
        )}

        {state === 'ready' && analysis && (
          <div className="animate-fade-in space-y-4">
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
          </div>
        )}
      </Container>
    </div>
  );
}
