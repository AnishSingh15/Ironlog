'use client';

import { AiLoadingIndicator } from '@/components/AiLoadingIndicator';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toast';
import { checkmarkDraw } from '@/lib/motion';
import { api, DayOfWeek, WeeklyPlan } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AutoAwesome, CalendarMonth } from '@mui/icons-material';
import { TextField } from '@mui/material';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type LoadState = 'idle' | 'loading' | 'unavailable' | 'error' | 'ready';

const ALL_DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function PlanPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [state, setState] = useState<LoadState>('idle');
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [goal, setGoal] = useState('');
  const [availableDays, setAvailableDays] = useState<DayOfWeek[]>([
    'Monday',
    'Wednesday',
    'Friday',
  ]);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState('60');
  const [justGenerated, setJustGenerated] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const toggleDay = (day: DayOfWeek) => {
    setAvailableDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]));
  };

  const generatePlan = async () => {
    setState('loading');
    setErrorMessage(null);

    const duration = parseInt(sessionDurationMinutes, 10);
    const response = await api.planWeek({
      goal: goal.trim() || undefined,
      availableDays: availableDays.length > 0 ? availableDays : undefined,
      sessionDurationMinutes: Number.isFinite(duration) ? duration : undefined,
    });

    if (response.success && response.data) {
      setPlan(response.data.plan);
      setState('ready');
      setSaveState('idle');
      setJustGenerated(true);
      setTimeout(() => setJustGenerated(false), 1800);
      return;
    }

    if (response.error?.message?.includes('OPENAI_API_KEY')) {
      setState('unavailable');
      return;
    }

    setErrorMessage(response.error?.message || 'Something went wrong planning your week.');
    setState('error');
  };

  const savePlan = async () => {
    if (!plan) return;
    setSaveState('saving');

    const response = await api.saveWeekPlan(plan);
    if (response.success && response.data) {
      const { savedDays, skippedDays } = response.data;
      setSaveState('saved');
      if (savedDays.length > 0) {
        toast.success(
          skippedDays.length > 0
            ? `Saved ${savedDays.join(', ')}. Skipped ${skippedDays.map(d => d.day).join(', ')} - already scheduled.`
            : `Saved to your calendar: ${savedDays.join(', ')}.`
        );
      } else {
        toast.error('Every day this week already has a workout scheduled - nothing to save.');
      }
      return;
    }

    setSaveState('idle');
    toast.error(response.error?.message || "Couldn't save this plan. Try again.");
  };

  return (
    <div className="min-h-screen bg-canvas pb-20 md:pb-0">
      <AppHeader title="Plan" showWeightToggle={false} />
      <div className="mx-auto max-w-4xl px-4 py-5 pb-24 md:pb-6">
        {(state === 'idle' || state === 'error' || state === 'unavailable') && (
          <Card className="mb-4">
            <p className="mb-4 text-sm text-text-secondary">
              Generate a 7-day training plan grounded in your real training history. This is a
              recommendation for you to review - it never overwrites anything automatically.
            </p>

            <TextField
              label="Goal (optional)"
              placeholder="e.g. Build strength, lose fat, general fitness"
              fullWidth
              size="small"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              className="mb-4"
            />

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Available days
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {ALL_DAYS.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={clsx(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    availableDays.includes(day)
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                  )}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>

            <TextField
              label="Session length (minutes)"
              type="number"
              size="small"
              fullWidth
              value={sessionDurationMinutes}
              onChange={e => setSessionDurationMinutes(e.target.value)}
              inputProps={{ min: 15, max: 180 }}
              className="mb-4"
            />

            <Button className="w-full" onClick={generatePlan}>
              <AutoAwesome fontSize="small" />
              Generate my week
            </Button>
          </Card>
        )}

        {state === 'loading' && <AiLoadingIndicator label="Building your week..." />}

        {state === 'unavailable' && (
          <EmptyState
            icon={<AutoAwesome fontSize="large" />}
            title="AI Coach isn't configured yet"
            description="The training planner needs an OpenAI API key set up on the server first."
          />
        )}

        {state === 'error' && (
          <EmptyState
            title="Couldn't generate a plan"
            description={errorMessage ?? undefined}
            action={
              <Button variant="secondary" onClick={generatePlan}>
                Try again
              </Button>
            }
          />
        )}

        {state === 'ready' && plan && (
          <div className="animate-fade-in space-y-4">
            <AnimatePresence>
              {justGenerated && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="11" stroke="hsl(var(--il-success))" strokeWidth="1.5" />
                    <motion.path
                      d="M7 12.5l3 3 7-7"
                      stroke="hsl(var(--il-success))"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      variants={checkmarkDraw}
                      initial="hidden"
                      animate="visible"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-success">Plan Generated</p>
                    <p className="text-xs text-text-secondary">Your weekly plan is ready!</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Card>
              <div className="flex items-center gap-2">
                <CalendarMonth className="text-accent" fontSize="small" />
                <p className="text-sm font-semibold text-text-primary">{plan.goal}</p>
              </div>
              <p className="mt-2 text-sm text-text-secondary">{plan.summary}</p>
            </Card>

            {plan.sessions.map(session => (
              <Card key={session.day}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">{session.day}</p>
                  <Badge tone={session.isRestDay ? 'neutral' : 'accent'}>
                    {session.isRestDay ? 'Rest' : session.focus}
                  </Badge>
                </div>

                {!session.isRestDay && session.exercises.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {session.exercises.map(ex => (
                      <li key={ex.name} className="flex justify-between text-sm">
                        <span className="text-text-primary">{ex.name}</span>
                        <span className="font-mono text-text-tertiary">
                          {ex.targetSets} x {ex.targetReps}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-2 text-xs text-text-tertiary">{session.reasoning}</p>
              </Card>
            ))}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={savePlan}
                disabled={saveState !== 'idle'}
              >
                {saveState === 'saved' ? 'Saved to your calendar' : saveState === 'saving' ? 'Saving...' : 'Save this week'}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setState('idle');
                  setSaveState('idle');
                }}
              >
                Adjust and regenerate
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
