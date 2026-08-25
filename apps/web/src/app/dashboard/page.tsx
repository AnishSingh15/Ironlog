'use client';

import { AppHeader } from '@/components/AppHeader';
import { RestTimer } from '@/components/RestTimer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Metric } from '@/components/ui/Metric';
import { useWeightUnit } from '@/contexts/WeightUnitContext';
import { useAuth } from '@/hooks/useAuth';
import { useTimer } from '@/hooks/useTimer';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useTimerStore } from '@/store/timer';
import { useWorkoutStore } from '@/store/workout';
import {
  Check as CheckIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  FitnessCenter as FitnessCenterIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  TextField,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.2, ease: 'easeOut' },
};

interface SetInputs {
  weight: string;
  reps: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const {
    currentWorkout,
    splitName,
    completionPercentage,
    isLoading: workoutLoading,
    setCurrentWorkout,
    setSplitName,
    setCompletionPercentage,
    setLoading: setWorkoutLoading,
    updateSetRecord,
    markSetCompleted,
  } = useWorkoutStore();

  const { isRunning, timeElapsed, currentSet, setCurrentSet: setTimerCurrentSet } = useTimerStore();
  const { logout } = useAuth();
  const { startTimer, stopTimer, resetTimer, formatTime } = useTimer();

  const [setInputs, setSetInputs] = useState<Record<string, SetInputs>>({});
  const [expandedExercise, setExpandedExercise] = useState<string | false>(false);
  const [error, setError] = useState<string | null>(null);
  const [isRestDay, setIsRestDay] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [availableExercises, setAvailableExercises] = useState<Record<string, any[]>>({});
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [customSets, setCustomSets] = useState<Record<string, number>>({});
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTimerFor, setRestTimerFor] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { useMetricSystem, formatWeightDisplay, getWeightUnit } = useWeightUnit();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      await loadTodaysWorkout();
      await loadExercises();
    };

    loadData();
  }, [isAuthenticated, router]);

  const loadTodaysWorkout = async () => {
    try {
      setWorkoutLoading(true);
      setError(null);
      setIsRestDay(false);

      const response = await api.get('/workouts/today');

      if (!response.success || !response.data) {
        setIsRestDay(false);
        setCurrentWorkout(null);
        setCompletionPercentage(0);
        setSplitName('');
        setSetInputs({});
        return;
      }

      const responseData = response.data as any;
      const {
        workoutDay,
        completionPercentage: completion,
        splitName: split,
      } = responseData.data || responseData;

      setCurrentWorkout(workoutDay);
      setCompletionPercentage(completion);
      setSplitName(split);

      const inputs: Record<string, SetInputs> = {};
      if (workoutDay.setRecords) {
        workoutDay.setRecords.forEach((set: any) => {
          if (!set.actualWeight || !set.actualReps) {
            inputs[set.id] = { weight: '', reps: '' };
          }
        });
      }
      setSetInputs(inputs);
    } catch (error: any) {
      if (error.response?.status === 404) {
        setCurrentWorkout(null);
        setIsRestDay(false);
        setCompletionPercentage(0);
        setSplitName('');
        setSetInputs({});
      } else if (error.response?.status === 204) {
        setIsRestDay(true);
        setCurrentWorkout(null);
        setCompletionPercentage(0);
        setSplitName('Rest Day');
        setSetInputs({});
      } else {
        console.error("Failed to load today's workout:", error);
        setError("Failed to load today's workout. Please try again.");
      }
    } finally {
      setWorkoutLoading(false);
    }
  };

  const confirmDeleteWorkout = () => {
    setShowDeleteDialog(true);
  };

  const deleteWorkout = async () => {
    if (!currentWorkout) return;

    try {
      setWorkoutLoading(true);
      setError(null);
      setShowDeleteDialog(false);

      const response = await api.delete(`/workouts/${currentWorkout.id}`);

      if (response.success) {
        setCurrentWorkout(null);
        setIsRestDay(false);
        setCompletionPercentage(0);
        setSplitName('');
        setSetInputs({});
        setExpandedExercise(false);
      } else {
        setError('Failed to delete workout. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to delete workout:', error);
      setError('Failed to delete workout. Please try again.');
    } finally {
      setWorkoutLoading(false);
    }
  };

  const loadExercises = async () => {
    try {
      setIsLoadingExercises(true);
      const response = await api.get('/exercises');

      if (response.success && response.data) {
        const responseData = response.data as any;

        if (responseData.exercisesByMuscleGroup) {
          setAvailableExercises(responseData.exercisesByMuscleGroup);
        } else if (responseData.data?.exercisesByMuscleGroup) {
          setAvailableExercises(responseData.data.exercisesByMuscleGroup);
        } else {
          console.warn('No exercisesByMuscleGroup found in response');
          setAvailableExercises({});
        }
      } else {
        console.error('Failed to load exercises - invalid response:', response);
        setError(`Failed to load exercises: ${response.error?.message || 'Unknown error'}`);
        setAvailableExercises({});
      }
    } catch (error) {
      console.error('Failed to load exercises:', error);
      setError('Failed to load exercises. Please try again.');
      setAvailableExercises({});
    } finally {
      setIsLoadingExercises(false);
    }
  };

  const createCustomWorkout = async () => {
    try {
      if (selectedExercises.length === 0) {
        setError('Please select at least one exercise.');
        return;
      }

      setIsStartingWorkout(true);
      setError(null);

      const response = await api.post('/workouts/custom', {
        exerciseIds: selectedExercises,
        customSets: Object.keys(customSets).length > 0 ? customSets : undefined,
      });

      const responseData = response.data as any;
      const {
        workoutDay,
        completionPercentage: completion,
        splitName: split,
      } = responseData.data || responseData;

      setCurrentWorkout(workoutDay);
      setCompletionPercentage(completion);
      setSplitName(split);

      const inputs: Record<string, SetInputs> = {};
      if (workoutDay.setRecords) {
        workoutDay.setRecords.forEach((set: any) => {
          if (!set.actualWeight || !set.actualReps) {
            inputs[set.id] = { weight: '', reps: '' };
          }
        });
      }
      setSetInputs(inputs);
      setShowWorkoutModal(false);
      setSelectedExercises([]);
      setCustomSets({});
    } catch (error: any) {
      console.error('Failed to create custom workout:', error);
      setError('Failed to create workout. Please try again.');
    } finally {
      setIsStartingWorkout(false);
    }
  };

  const toggleExerciseSelection = (exerciseId: string) => {
    setSelectedExercises(prev =>
      prev.includes(exerciseId) ? prev.filter(id => id !== exerciseId) : [...prev, exerciseId]
    );
  };

  const updateCustomSets = (exerciseId: string, sets: number) => {
    setCustomSets(prev => ({ ...prev, [exerciseId]: sets }));
  };

  const handleSetInputChange = (setId: string, field: 'weight' | 'reps', value: string) => {
    setSetInputs(prev => ({
      ...prev,
      [setId]: { ...prev[setId], [field]: value } as SetInputs,
    }));
  };

  const handleSetSubmit = async (setId: string) => {
    try {
      const inputs = setInputs[setId];
      if (!inputs || inputs.weight === '' || inputs.reps === '') {
        setError('Please enter both weight and reps values.');
        return;
      }

      const weightValue = parseFloat(inputs.weight);
      const repsValue = parseInt(inputs.reps);

      if (isNaN(weightValue) || isNaN(repsValue)) {
        setError('Please enter valid numbers for weight and reps.');
        return;
      }

      if (weightValue < 0) {
        setError('Weight cannot be negative. Use 0 for bodyweight exercises.');
        return;
      }

      if (repsValue <= 0) {
        setError('Reps must be a positive number.');
        return;
      }

      setError(null);

      await api.patch(`/set-records/${setId}`, {
        actualWeight: weightValue,
        actualReps: repsValue,
      });

      const currentSetRecord = currentWorkout?.setRecords?.find(set => set.id === setId);
      if (currentSetRecord) {
        const updatedSetRecord = {
          ...currentSetRecord,
          actualWeight: weightValue,
          actualReps: repsValue,
          completed: true,
        };
        updateSetRecord(updatedSetRecord);
        markSetCompleted(currentSetRecord.exerciseId, currentSetRecord.setIndex);
      }

      setSetInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[setId];
        return newInputs;
      });

      setRestTimerFor(setId);
      setShowRestTimer(true);

      if (currentWorkout && currentWorkout.setRecords) {
        const totalSets = currentWorkout.setRecords.length;
        const completedSets = currentWorkout.setRecords.filter(
          set => set.id === setId || (set.actualWeight !== null && set.actualReps !== null)
        ).length;
        const newCompletion = Math.round((completedSets / totalSets) * 100);
        setCompletionPercentage(newCompletion);

        if (newCompletion === 100) {
          setTimeout(() => {
            handleCompleteWorkout();
          }, 1500);
        }
      }
    } catch (error: any) {
      console.error('Failed to update set:', error);
      setError('Failed to update set. Please try again.');
    }
  };

  const handleCompleteWorkout = async () => {
    if (!currentWorkout) return;

    try {
      await api.patch(`/workouts/${currentWorkout.id}/complete`);
      setError(null);
      loadTodaysWorkout();
    } catch (error: any) {
      console.error('Failed to complete workout:', error);
      setError('Failed to complete workout. Please try again.');
    }
  };

  const handleMarkAllDone = async () => {
    if (!currentWorkout || !currentWorkout.setRecords) return;

    try {
      setError(null);

      const incompleteSets = currentWorkout.setRecords.filter(
        set => set.actualWeight === null || set.actualReps === null
      );

      for (const set of incompleteSets) {
        const defaultWeight = set.plannedWeight || 0;
        const defaultReps = set.plannedReps || set.exercise.defaultReps;

        await api.patch(`/set-records/${set.id}`, {
          actualWeight: defaultWeight,
          actualReps: defaultReps,
        });

        const updatedSetRecord = {
          ...set,
          actualWeight: defaultWeight,
          actualReps: defaultReps,
          completed: true,
        };
        updateSetRecord(updatedSetRecord);
        markSetCompleted(set.exerciseId, set.setIndex);
      }

      setCompletionPercentage(100);

      setTimeout(() => {
        handleCompleteWorkout();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to mark all sets as done:', error);
      setError('Failed to mark all sets as done. Please try again.');
    }
  };

  const handleStartSet = (setId: string) => {
    setTimerCurrentSet(setId);
    startTimer();
  };

  const handleAccordionChange =
    (exerciseId: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedExercise(isExpanded ? exerciseId : false);
    };

  const handleRestTimerEnd = () => {
    // Rest complete - the RestTimer component itself surfaces the finished state.
  };

  const handleCloseRestTimer = () => {
    setShowRestTimer(false);
    setRestTimerFor(null);
  };

  const renderTimerFab = () => {
    if (!currentSet) return null;

    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        className="fixed bottom-24 right-4 z-40 md:bottom-6"
      >
        <button
          onClick={isRunning ? stopTimer : resetTimer}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg"
        >
          {isRunning ? <PauseIcon fontSize="small" /> : <TimerIcon fontSize="small" />}
          <span className="font-mono text-[10px]">{formatTime(timeElapsed)}</span>
        </button>
      </motion.div>
    );
  };

  const renderWorkoutSummary = () => {
    if (!currentWorkout || !currentWorkout.setRecords) return null;

    const totalSets = currentWorkout.setRecords.length;
    const completedSets = currentWorkout.setRecords.filter(
      set => set.actualWeight !== null && set.actualReps !== null
    ).length;

    return (
      <motion.div {...fadeInUp}>
        <Card className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FitnessCenterIcon className="text-accent" fontSize="small" />
              <h2 className="text-base font-semibold text-text-primary">Today&apos;s Workout</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="accent">{splitName}</Badge>
              <button
                onClick={confirmDeleteWorkout}
                title="Delete Workout"
                className="rounded p-1 text-text-tertiary hover:text-danger"
              >
                <DeleteIcon fontSize="small" />
              </button>
            </div>
          </div>

          <p className="mb-1.5 text-sm text-text-secondary">
            {completedSets}/{totalSets} sets completed ({completionPercentage}%)
          </p>
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {completionPercentage < 100 && !currentWorkout.completed && (
            <Button variant="secondary" className="mb-2 w-full" onClick={handleMarkAllDone}>
              <CheckIcon fontSize="small" />
              Mark all sets as done
            </Button>
          )}

          {completionPercentage === 100 && !currentWorkout.completed && (
            <Button className="w-full" onClick={handleCompleteWorkout}>
              <CheckIcon fontSize="small" />
              Complete workout
            </Button>
          )}

          {currentWorkout.completed && (
            <div>
              <Alert severity="success" className="!mb-3 !rounded-lg">
                Workout completed. Great job.
              </Alert>
              <Button
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  try {
                    await api.patch(`/workouts/${currentWorkout.id}/uncomplete`);
                    const updatedWorkout = await api.getTodayWorkout();
                    const updatedData = updatedWorkout.data as any;
                    setCurrentWorkout(updatedData.data || updatedData);
                  } catch (error) {
                    console.error('Failed to restart workout:', error);
                    if (currentWorkout) {
                      setCurrentWorkout({ ...currentWorkout, completed: false });
                    }
                  }
                }}
              >
                Continue training
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    );
  };

  const renderExercises = () => {
    if (!currentWorkout || !currentWorkout.setRecords) return null;

    const exerciseGroups = currentWorkout.setRecords.reduce((acc: any, set: any) => {
      const exerciseId = set.exercise.id;
      if (!acc[exerciseId]) {
        acc[exerciseId] = { exercise: set.exercise, sets: [] };
      }
      acc[exerciseId].sets.push(set);
      return acc;
    }, {});

    return (
      <div>
        {Object.entries(exerciseGroups).map(([exerciseId, group]: [string, any]) => {
          const allDone = group.sets.every(
            (s: any) => s.actualWeight !== null && s.actualReps !== null
          );
          const doneCount = group.sets.filter(
            (s: any) => s.actualWeight !== null && s.actualReps !== null
          ).length;

          return (
            <Accordion
              key={exerciseId}
              expanded={expandedExercise === exerciseId}
              onChange={handleAccordionChange(exerciseId)}
              className="!mb-3 !rounded-xl !border !border-border-default !shadow-none before:!hidden"
              disableGutters
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <div className="flex w-full items-center justify-between pr-2">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{group.exercise.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {group.exercise.muscleGroup} &middot; {group.sets.length} sets
                    </p>
                  </div>
                  <Badge tone={allDone ? 'success' : 'neutral'}>
                    {doneCount}/{group.sets.length}
                  </Badge>
                </div>
              </AccordionSummary>
              <AccordionDetails className="!flex !flex-col !gap-3 !border-t !border-border-default !p-4">
                {group.sets.map((set: any, index: number) => {
                  const done = set.actualWeight !== null && set.actualReps !== null;
                  return (
                    <div
                      key={set.id}
                      className={
                        done
                          ? 'rounded-lg border border-success/30 bg-success/5 p-3'
                          : 'rounded-lg border border-border-default p-3'
                      }
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-text-primary">Set {index + 1}</p>
                        {done ? (
                          <Badge tone="success">Completed</Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={currentSet === set.id && isRunning}
                            onClick={() => handleStartSet(set.id)}
                          >
                            <PlayIcon fontSize="small" />
                            {currentSet === set.id && isRunning ? 'Active' : 'Start'}
                          </Button>
                        )}
                      </div>

                      {done ? (
                        <div>
                          <Metric value={formatWeightDisplay(set.actualWeight)} unit={set.actualReps + ' reps'} />
                          <p className="mt-1 text-xs text-text-tertiary">Target: {set.plannedReps} reps</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setRestTimerFor(set.id);
                              setShowRestTimer(true);
                            }}
                          >
                            <TimerIcon fontSize="small" />
                            Rest timer
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 items-end gap-2">
                          <TextField
                            label={`Weight (${getWeightUnit()})`}
                            type="number"
                            size="small"
                            value={setInputs[set.id]?.weight || ''}
                            onChange={e => handleSetInputChange(set.id, 'weight', e.target.value)}
                          />
                          <TextField
                            label="Reps"
                            type="number"
                            size="small"
                            value={setInputs[set.id]?.reps || ''}
                            onChange={e => handleSetInputChange(set.id, 'reps', e.target.value)}
                          />
                          <Button
                            size="sm"
                            disabled={
                              !setInputs[set.id] ||
                              setInputs[set.id]?.weight === '' ||
                              setInputs[set.id]?.reps === ''
                            }
                            onClick={() => handleSetSubmit(set.id)}
                          >
                            Log
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </div>
    );
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <AppHeader title="Workout" />
      <div className="min-h-screen bg-canvas pb-24 md:pb-6">
        <div className="mx-auto max-w-2xl px-4 py-5">
          {error && (
            <Alert severity="error" className="!mb-4 !rounded-lg" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {workoutLoading ? (
            <Card className="py-12 text-center">
              <p className="text-sm text-text-secondary">Loading your workout...</p>
            </Card>
          ) : currentWorkout ? (
            <>
              {renderWorkoutSummary()}
              {renderExercises()}
            </>
          ) : isRestDay ? (
            <EmptyState
              icon={<FitnessCenterIcon fontSize="large" />}
              title="Rest day"
              description="Take a well-deserved break. Recovery is just as important as training."
            />
          ) : (
            <EmptyState
              icon={<FitnessCenterIcon fontSize="large" />}
              title="No workout scheduled today"
              description="Build a session by selecting exercises."
              action={<Button onClick={() => setShowWorkoutModal(true)}>Start workout</Button>}
            />
          )}
        </div>

        <AnimatePresence>{renderTimerFab()}</AnimatePresence>

        <Dialog
          open={showWorkoutModal}
          onClose={() => setShowWorkoutModal(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <p className="text-lg font-semibold text-text-primary">Create your workout</p>
            <p className="text-sm font-normal text-text-secondary">
              Select exercises for today&apos;s session
            </p>
          </DialogTitle>
          <DialogContent dividers>
            {isLoadingExercises ? (
              <p className="py-8 text-center text-sm text-text-secondary">Loading exercises...</p>
            ) : (
              <div className="flex flex-col gap-5">
                {Object.entries(availableExercises).map(([muscleGroup, exercises]) => (
                  <div key={muscleGroup}>
                    <p className="mb-2 text-sm font-semibold text-text-primary">{muscleGroup}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {exercises.map((exercise: any) => {
                        const isSelected = selectedExercises.includes(exercise.id);
                        const customSetCount = customSets[exercise.id] || exercise.defaultSets;

                        return (
                          <div
                            key={exercise.id}
                            onClick={() => toggleExerciseSelection(exercise.id)}
                            className={
                              isSelected
                                ? 'cursor-pointer rounded-lg border-2 border-accent bg-accent/10 p-3'
                                : 'cursor-pointer rounded-lg border border-border-default p-3 hover:border-border-strong'
                            }
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">
                                  {exercise.name}
                                </p>
                                <p className="text-xs text-text-tertiary">
                                  {exercise.defaultReps} reps x {customSetCount} sets
                                </p>
                              </div>
                              {isSelected && <CheckIcon fontSize="small" className="text-accent" />}
                            </div>

                            {isSelected && (
                              <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <span className="text-xs text-text-tertiary">Sets:</span>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={customSetCount}
                                  onChange={e =>
                                    updateCustomSets(
                                      exercise.id,
                                      parseInt(e.target.value) || exercise.defaultSets
                                    )
                                  }
                                  inputProps={{ min: 1, max: 10 }}
                                  className="w-20"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
          <DialogActions className="!flex-col !items-stretch !gap-2 !p-4">
            {selectedExercises.length > 0 && (
              <p className="text-center text-xs text-text-tertiary">
                {selectedExercises.length} exercise{selectedExercises.length !== 1 ? 's' : ''} selected
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowWorkoutModal(false)}
                disabled={isStartingWorkout}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={createCustomWorkout}
                disabled={isStartingWorkout || selectedExercises.length === 0}
              >
                {isStartingWorkout ? 'Creating...' : 'Start workout'}
              </Button>
            </div>
          </DialogActions>
        </Dialog>

        <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
          <DialogTitle>Delete workout?</DialogTitle>
          <DialogContent>
            <p className="text-sm text-text-secondary">
              This can&apos;t be undone. You&apos;ll return to the choice between starting a new
              workout or taking a rest day.
            </p>
          </DialogContent>
          <DialogActions>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteWorkout}>
              Delete workout
            </Button>
          </DialogActions>
        </Dialog>

        {showRestTimer && (
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4"
            onClick={handleCloseRestTimer}
          >
            <div onClick={e => e.stopPropagation()}>
              <RestTimer
                isVisible={showRestTimer}
                onTimerEnd={handleRestTimerEnd}
                onClose={handleCloseRestTimer}
                defaultTime={180}
              />
            </div>
          </div>
        )}

        {currentWorkout && !showRestTimer && (
          <Fab
            aria-label="rest timer"
            onClick={() => {
              setRestTimerFor('quick-timer');
              setShowRestTimer(true);
            }}
            className="!fixed !bottom-24 !right-4 !z-40 md:!bottom-6 !bg-accent !text-white"
          >
            <TimerIcon />
          </Fab>
        )}
      </div>
    </>
  );
}
