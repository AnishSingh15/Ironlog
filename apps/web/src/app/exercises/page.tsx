'use client';

import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Button as IlButton } from '@/components/ui/Button';
import { Card as IlCard } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useExercises, type Exercise, type ExerciseFormData } from '@/hooks/useExercises';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Full Body'];

export default function ExercisesPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [formData, setFormData] = useState<ExerciseFormData>({
    name: '',
    muscleGroup: '',
    defaultSets: 3,
    defaultReps: 10,
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const { exercises, loading, error, createExercise, updateExercise, deleteExercise } =
    useExercises({
      search: searchTerm,
      muscleGroup: selectedMuscleGroup,
    });

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning' = 'success'
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleOpenDialog = (exercise?: Exercise) => {
    if (exercise) {
      setEditingExercise(exercise);
      setFormData({
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        defaultSets: exercise.defaultSets,
        defaultReps: exercise.defaultReps,
      });
    } else {
      setEditingExercise(null);
      setFormData({ name: '', muscleGroup: '', defaultSets: 3, defaultReps: 10 });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingExercise(null);
    setFormData({ name: '', muscleGroup: '', defaultSets: 3, defaultReps: 10 });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.muscleGroup) {
      return;
    }

    try {
      setSubmitLoading(true);

      const result = editingExercise
        ? await updateExercise(editingExercise.id, formData)
        : await createExercise(formData);

      if (result.success) {
        handleCloseDialog();
        showSnackbar(
          editingExercise
            ? `Exercise "${formData.name}" updated successfully!`
            : `Exercise "${formData.name}" added successfully!`,
          'success'
        );
      } else {
        showSnackbar(result.error || 'Failed to save exercise', 'error');
      }
    } catch (error) {
      console.error('Error saving exercise:', error);
      showSnackbar('Failed to save exercise', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (exercise: Exercise) => {
    if (!confirm(`Are you sure you want to delete "${exercise.name}"?`)) {
      return;
    }

    try {
      const result = await deleteExercise(exercise.id);
      if (result.success) {
        showSnackbar(`Exercise "${exercise.name}" deleted successfully!`, 'success');
      } else {
        showSnackbar(result.error || 'Failed to delete exercise', 'error');
      }
    } catch (error) {
      console.error('Error deleting exercise:', error);
      showSnackbar('Failed to delete exercise', 'error');
    }
  };

  const filteredExercises = exercises.filter(exercise => {
    const matchesSearch =
      !searchTerm || exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMuscleGroup = !selectedMuscleGroup || exercise.muscleGroup === selectedMuscleGroup;
    return matchesSearch && matchesMuscleGroup;
  });

  const exercisesByMuscleGroup = filteredExercises.reduce(
    (acc, exercise) => {
      const group = exercise.muscleGroup;
      if (!acc[group]) acc[group] = [];
      acc[group].push(exercise);
      return acc;
    },
    {} as Record<string, Exercise[]>
  );

  return (
    <>
      <AppHeader title="Exercises" showWeightToggle={false} />

      <div className="mx-auto max-w-5xl px-4 py-5 pb-24 md:pb-6">
        <div className="mb-5">
          <p className="mb-3 text-sm text-text-secondary">
            Manage your exercise library - add, edit, or remove exercises used in workouts.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <TextField
              placeholder="Search exercises..."
              size="small"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" className="mr-1 text-text-tertiary" />,
              }}
              className="min-w-[220px]"
            />

            <FormControl size="small" className="min-w-[160px]">
              <InputLabel>Muscle Group</InputLabel>
              <Select
                value={selectedMuscleGroup}
                onChange={e => setSelectedMuscleGroup(e.target.value)}
                label="Muscle Group"
              >
                <MenuItem value="">All groups</MenuItem>
                {MUSCLE_GROUPS.map(group => (
                  <MenuItem key={group} value={group}>
                    {group}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <IlButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedMuscleGroup('');
              }}
            >
              Clear filters
            </IlButton>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <CircularProgress size={28} />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <Alert severity="error" className="!mb-3 !rounded-lg">
              {error}
            </Alert>
            <IlButton variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </IlButton>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <p className="mb-2 text-sm font-medium text-text-secondary">
                {filteredExercises.length} total exercises
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(exercisesByMuscleGroup).map(([group, groupExercises]) => (
                  <Badge key={group}>
                    {group} ({groupExercises.length})
                  </Badge>
                ))}
              </div>
            </div>

            {Object.entries(exercisesByMuscleGroup).map(([muscleGroup, groupExercises]) => (
              <div key={muscleGroup} className="mb-6">
                <h2 className="mb-2 text-sm font-semibold text-text-primary">
                  {muscleGroup} ({groupExercises.length})
                </h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {groupExercises.map(exercise => (
                    <IlCard
                      key={exercise.id}
                      className="flex cursor-pointer flex-col justify-between transition-colors hover:bg-surface-2"
                      onClick={() => router.push(`/exercises/${exercise.id}`)}
                    >
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{exercise.name}</p>
                        <Badge className="mt-1.5">{exercise.muscleGroup}</Badge>
                        <p className="mt-2 text-xs text-text-tertiary">
                          Default: {exercise.defaultSets} sets x {exercise.defaultReps} reps
                        </p>
                      </div>
                      <div className="mt-3 flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <IconButton size="small" onClick={() => handleOpenDialog(exercise)}>
                          <EditIcon fontSize="small" className="text-text-secondary" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(exercise)}>
                          <DeleteIcon fontSize="small" className="text-danger" />
                        </IconButton>
                      </div>
                    </IlCard>
                  ))}
                </div>
              </div>
            ))}

            {filteredExercises.length === 0 && (
              <EmptyState
                title="No exercises found"
                description={
                  searchTerm || selectedMuscleGroup
                    ? 'Try adjusting your search filters.'
                    : 'Get started by adding your first exercise.'
                }
              />
            )}
          </>
        )}

        <Fab
          aria-label="add exercise"
          onClick={() => handleOpenDialog()}
          className="!fixed !bottom-24 !right-4 !z-40 md:!bottom-6 !bg-accent !text-white"
        >
          <AddIcon />
        </Fab>

        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingExercise ? 'Edit exercise' : 'Add new exercise'}</DialogTitle>

          <DialogContent>
            <div className="flex flex-col gap-4 pt-1">
              <TextField
                label="Exercise name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
                placeholder="e.g., Bench Press, Squats"
              />

              <FormControl fullWidth required>
                <InputLabel>Muscle group</InputLabel>
                <Select
                  value={formData.muscleGroup}
                  onChange={e => setFormData({ ...formData, muscleGroup: e.target.value })}
                  label="Muscle group"
                >
                  {MUSCLE_GROUPS.map(group => (
                    <MenuItem key={group} value={group}>
                      {group}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <div className="flex gap-3">
                <TextField
                  label="Default sets"
                  type="number"
                  value={formData.defaultSets}
                  onChange={e =>
                    setFormData({ ...formData, defaultSets: parseInt(e.target.value) || 1 })
                  }
                  inputProps={{ min: 1, max: 10 }}
                  fullWidth
                />

                <TextField
                  label="Default reps"
                  type="number"
                  value={formData.defaultReps}
                  onChange={e =>
                    setFormData({ ...formData, defaultReps: parseInt(e.target.value) || 1 })
                  }
                  inputProps={{ min: 1, max: 100 }}
                  fullWidth
                />
              </div>
            </div>
          </DialogContent>

          <DialogActions className="!p-4">
            <IlButton variant="ghost" onClick={handleCloseDialog}>
              Cancel
            </IlButton>
            <IlButton
              onClick={handleSubmit}
              disabled={!formData.name.trim() || !formData.muscleGroup || submitLoading}
            >
              {submitLoading ? (
                <CircularProgress size={18} className="!text-accent-foreground" />
              ) : editingExercise ? (
                'Update exercise'
              ) : (
                'Add exercise'
              )}
            </IlButton>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} className="!w-full">
            {snackbar.message}
          </Alert>
        </Snackbar>
      </div>
    </>
  );
}
