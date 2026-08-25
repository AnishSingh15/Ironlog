import { Exercise, PrismaClient } from '@prisma/client';
import { Response, Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { analyticsService } from '../services/analytics.service';
import { calculateProgress } from '../services/progression';
import { detectPlateau } from '../services/plateau';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/exercises
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { muscleGroup, search } = req.query;

    // Build where clause for filtering
    const where: Record<string, unknown> = {};
    if (muscleGroup && typeof muscleGroup === 'string') {
      where.muscleGroup = muscleGroup;
    }
    if (search && typeof search === 'string') {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const exercises = await prisma.exercise.findMany({
      where,
      orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
    });

    // Group exercises by muscle group
    const exercisesByMuscleGroup = exercises.reduce(
      (acc: Record<string, Exercise[]>, exercise: Exercise) => {
        const muscleGroup = exercise.muscleGroup;
        if (!acc[muscleGroup]) {
          acc[muscleGroup] = [];
        }
        acc[muscleGroup]!.push(exercise);
        return acc;
      },
      {} as Record<string, Exercise[]>
    );

    // Get muscle group stats
    const muscleGroups = await prisma.exercise.groupBy({
      by: ['muscleGroup'],
      _count: {
        muscleGroup: true,
      },
      orderBy: {
        muscleGroup: 'asc',
      },
    });

    res.json({
      success: true,
      data: {
        exercises,
        exercisesByMuscleGroup,
        muscleGroups: muscleGroups.map(mg => ({
          name: mg.muscleGroup,
          count: mg._count.muscleGroup,
        })),
        total: exercises.length,
      },
    });
  } catch (error) {
    console.error('Get exercises error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

// GET /api/v1/exercises/popular - Get most used exercises
router.get('/popular', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    // Get exercises with their usage count
    const popularExercises = await prisma.exercise.findMany({
      include: {
        _count: {
          select: {
            setRecords: true,
          },
        },
      },
      orderBy: {
        setRecords: {
          _count: 'desc',
        },
      },
      take: parseInt(limit as string),
    });

    res.json({
      success: true,
      data: {
        exercises: popularExercises.map(ex => ({
          ...ex,
          usageCount: ex._count.setRecords,
        })),
      },
    });
  } catch (error) {
    console.error('Get popular exercises error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

// GET /api/v1/exercises/:id - Get specific exercise with recent performance
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Exercise ID is required' },
      });
    }

    const exercise = await prisma.exercise.findUnique({
      where: { id: id },
    });

    if (!exercise) {
      return res.status(404).json({
        success: false,
        error: { message: 'Exercise not found' },
      });
    }

    const history = await analyticsService.getExerciseHistory(userId, exercise.name, 100);
    const personalBest = history.reduce<(typeof history)[number] | null>((best, set) => {
      if (!best) return set;
      if (set.actualWeight > best.actualWeight) return set;
      if (set.actualWeight === best.actualWeight && set.actualReps > best.actualReps) return set;
      return best;
    }, null);
    const recommendation =
      history.length > 0
        ? calculateProgress(history, exercise.defaultReps, exercise.muscleGroup)
        : null;
    const plateau = history.length > 0 ? detectPlateau(history, exercise.defaultReps) : null;

    return res.json({
      success: true,
      data: {
        exercise,
        history,
        personalBest,
        recommendation,
        plateau,
      },
    });
  } catch (error) {
    console.error('Get exercise error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

// POST /api/v1/exercises - Create new exercise
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, muscleGroup, defaultSets, defaultReps } = req.body;

    if (!name || !muscleGroup) {
      return res.status(400).json({
        success: false,
        error: { message: 'Name and muscle group are required' },
      });
    }

    // Check if exercise already exists
    const existingExercise = await prisma.exercise.findUnique({
      where: { name },
    });

    if (existingExercise) {
      return res.status(409).json({
        success: false,
        error: { message: 'Exercise already exists' },
      });
    }

    const exercise = await prisma.exercise.create({
      data: {
        name,
        muscleGroup,
        defaultSets: defaultSets || 3,
        defaultReps: defaultReps || 10,
      },
    });

    return res.status(201).json({
      success: true,
      data: { exercise },
    });
  } catch (error) {
    console.error('Create exercise error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

// PUT /api/v1/exercises/:id - Update existing exercise
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, muscleGroup, defaultSets, defaultReps } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Exercise ID is required' },
      });
    }

    // Check if exercise exists
    const existingExercise = await prisma.exercise.findUnique({
      where: { id },
    });

    if (!existingExercise) {
      return res.status(404).json({
        success: false,
        error: { message: 'Exercise not found' },
      });
    }

    // If name is being changed, check for conflicts
    if (name && name !== existingExercise.name) {
      const nameConflict = await prisma.exercise.findUnique({
        where: { name },
      });

      if (nameConflict) {
        return res.status(409).json({
          success: false,
          error: { message: 'Exercise name already exists' },
        });
      }
    }

    // Update exercise with only provided fields
    const updateData: Partial<
      Pick<Exercise, 'name' | 'muscleGroup' | 'defaultSets' | 'defaultReps'>
    > = {};
    if (name !== undefined) updateData.name = name;
    if (muscleGroup !== undefined) updateData.muscleGroup = muscleGroup;
    if (defaultSets !== undefined) updateData.defaultSets = defaultSets;
    if (defaultReps !== undefined) updateData.defaultReps = defaultReps;

    const updatedExercise = await prisma.exercise.update({
      where: { id },
      data: updateData,
    });

    return res.json({
      success: true,
      data: { exercise: updatedExercise },
    });
  } catch (error) {
    console.error('Update exercise error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

// DELETE /api/v1/exercises/:id - Delete exercise
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Exercise ID is required' },
      });
    }

    // Check if exercise exists
    const existingExercise = await prisma.exercise.findUnique({
      where: { id },
    });

    if (!existingExercise) {
      return res.status(404).json({
        success: false,
        error: { message: 'Exercise not found' },
      });
    }

    // Check if exercise is being used in any set records
    const setRecordsCount = await prisma.setRecord.count({
      where: { exerciseId: id },
    });

    if (setRecordsCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          message: `Cannot delete exercise "${existingExercise.name}" as it is used in ${setRecordsCount} set record(s). Please remove all related records first.`,
        },
      });
    }

    // Delete the exercise
    await prisma.exercise.delete({
      where: { id },
    });

    return res.json({
      success: true,
      data: { message: `Exercise "${existingExercise.name}" deleted successfully` },
    });
  } catch (error) {
    console.error('Delete exercise error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

export default router;
