import { PrismaClient } from '@prisma/client';
import { Response, Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { AgentOutputError, runAgent } from '../ai/agentRunner';
import { agentRunLogger } from '../ai/agentRunLogger';
import { AiNotConfiguredError, getOpenAIClient } from '../ai/openaiClient';
import { analyticsTools } from '../ai/tools/analyticsTools';
import { progressionTools } from '../ai/tools/progressionTools';
import { plateauTools } from '../ai/tools/plateauTools';
import { knowledgeTools } from '../ai/tools/knowledgeTools';
import { embedTexts } from '../ai/rag/embeddings';
import { searchKnowledge } from '../ai/rag/retrieval';
import { workoutAnalysisSchema } from '../ai/schemas/workoutAnalysis';
import { planWeekRequestSchema, weeklyPlanSchema } from '../ai/schemas/weeklyPlan';
import { analyticsService } from '../services/analytics.service';
import { calculateProgress } from '../services/progression';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

const coachTools = [...analyticsTools, ...progressionTools, ...plateauTools, ...knowledgeTools];

const SYSTEM_PROMPT = `You are IronLog's training coach. You analyze a user's real workout data using the
provided tools, then respond with ONLY a JSON object matching this shape:
{
  "summary": string,
  "recommendations": [{ "type": "progression_recommendation", "exercise": string,
    "action": "increase_weight" | "maintain" | "deload" | "insufficient_data",
    "recommendedWeightKg": number, "targetSets": number, "targetReps": string,
    "confidence": number, "evidence": string[], "reasoning": string }],
  "plateauedExercises": string[],
  "overallTrend": "improving" | "steady" | "declining" | "insufficient_data"
}
Never invent numbers you did not get from a tool call. Use searchFitnessKnowledge when you need general
training principles (progressive overload, recovery, volume, plateaus) to justify a recommendation, and
add a "knowledge:<source>" entry to that recommendation's evidence array when you do. If there is not
enough data, say so and use "insufficient_data". You are not a doctor: if the user mentions pain, injury,
or medical symptoms, tell them to consult a qualified professional instead of diagnosing anything.`;

router.post('/analyze-workout', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const startedAt = new Date();

  try {
    const client = getOpenAIClient();
    const { output, toolCalls, usage } = await runAgent({
      client,
      userId,
      model: config.openaiModel,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'Analyze my recent training and tell me what to do next.',
      tools: coachTools,
      outputSchema: workoutAnalysisSchema,
    });

    await agentRunLogger.log({
      userId,
      workflow: 'analyze_workout',
      model: config.openaiModel,
      status: 'success',
      toolCalls,
      tokensPrompt: usage.promptTokens,
      tokensCompletion: usage.completionTokens,
      startedAt,
      finishedAt: new Date(),
    });

    return res.json({ success: true, data: { analysis: output } });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return res.status(503).json({ success: false, error: { message: error.message } });
    }

    await agentRunLogger.log({
      userId,
      workflow: 'analyze_workout',
      model: config.openaiModel,
      status: error instanceof AgentOutputError ? 'validation_failed' : 'error',
      toolCalls: [],
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      startedAt,
      finishedAt: new Date(),
    });

    console.error('AI workout analysis error:', error);
    return res.status(502).json({
      success: false,
      error: { message: 'AI analysis is temporarily unavailable' },
    });
  }
});

router.get('/fitness-state', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const [trainingFrequency, weeklyVolume, muscleGroupVolume, consistencyScore, plateauAlert] =
      await Promise.all([
        analyticsService.getTrainingFrequency(userId, 8),
        analyticsService.getWeeklyVolume(userId, 8),
        analyticsService.getMuscleGroupVolume(userId, 8),
        analyticsService.getConsistency(userId, 8),
        analyticsService.getTopPlateauAlert(userId),
      ]);

    return res.json({
      success: true,
      data: { trainingFrequency, weeklyVolume, muscleGroupVolume, consistencyScore, plateauAlert },
    });
  } catch (error) {
    console.error('Fitness state error:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

router.get('/week-calendar', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const days = await analyticsService.getWeekCalendar(userId);
    return res.json({ success: true, data: { days } });
  } catch (error) {
    console.error('Week calendar error:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

// Deterministic, no LLM call - safe to fetch inline while logging a set or viewing an
// exercise's detail page. Powers the "Keep Weight" / "Adapt" suggestion in the workout flow.
router.get('/exercise-recommendation', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const exerciseName = req.query.exercise as string | undefined;

  if (!exerciseName) {
    return res.status(400).json({ success: false, error: { message: 'exercise query param is required' } });
  }

  try {
    const exercise = await prisma.exercise.findUnique({ where: { name: exerciseName } });
    if (!exercise) {
      return res.status(404).json({ success: false, error: { message: 'Exercise not found' } });
    }

    const history = await analyticsService.getExerciseHistory(userId, exerciseName, 20);
    const recommendation = calculateProgress(history, exercise.defaultReps, exercise.muscleGroup);

    return res.json({ success: true, data: { recommendation } });
  } catch (error) {
    console.error('Exercise recommendation error:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

const PLAN_WEEK_SYSTEM_PROMPT = `You are IronLog's training coach, building a personalized 7-day training
plan for the week ahead. Use the provided tools to ground the plan in the user's real training history -
recent frequency, weekly volume, exercises that are plateaued, and general programming knowledge via
searchFitnessKnowledge. Respond with ONLY a JSON object matching this shape:
{
  "goal": string,
  "summary": string,
  "sessions": [{ "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
    "focus": string, "isRestDay": boolean, "exercises": [{ "name": string, "targetSets": number,
    "targetReps": string }], "reasoning": string }]
}
"sessions" MUST have exactly 7 entries, one per day of the week, in order starting Monday. Rest days have
isRestDay: true and an empty exercises array. Respect the user's stated available days, equipment, and
session duration if given - days not listed as available should be rest days. This plan is a
recommendation the user must explicitly review and apply; never claim it has already replaced their
program. You are not a doctor: if the user's stated goal or constraints mention pain or injury, tell them
to consult a qualified professional instead of programming around it silently.`;

router.post('/plan-week', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const startedAt = new Date();

  try {
    const input = planWeekRequestSchema.parse(req.body ?? {});
    const client = getOpenAIClient();

    const preferenceLines = [
      input.goal ? `Goal: ${input.goal}` : 'Goal: not specified - infer a sensible one from history.',
      input.availableDays
        ? `Available training days: ${input.availableDays.join(', ')}`
        : 'Available training days: not specified - assume any day can be a training day.',
      input.sessionDurationMinutes
        ? `Target session length: ${input.sessionDurationMinutes} minutes`
        : 'Target session length: not specified.',
      input.equipment
        ? `Available equipment: ${input.equipment.join(', ')}`
        : 'Available equipment: not specified - assume standard gym equipment.',
    ].join('\n');

    const { output, toolCalls, usage } = await runAgent({
      client,
      userId,
      model: config.openaiModel,
      systemPrompt: PLAN_WEEK_SYSTEM_PROMPT,
      userMessage: `Plan my next training week.\n${preferenceLines}`,
      tools: coachTools,
      outputSchema: weeklyPlanSchema,
    });

    await agentRunLogger.log({
      userId,
      workflow: 'plan_week',
      model: config.openaiModel,
      status: 'success',
      toolCalls,
      tokensPrompt: usage.promptTokens,
      tokensCompletion: usage.completionTokens,
      startedAt,
      finishedAt: new Date(),
    });

    return res.json({ success: true, data: { plan: output } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid input data', details: error.errors },
      });
    }
    if (error instanceof AiNotConfiguredError) {
      return res.status(503).json({ success: false, error: { message: error.message } });
    }

    await agentRunLogger.log({
      userId,
      workflow: 'plan_week',
      model: config.openaiModel,
      status: error instanceof AgentOutputError ? 'validation_failed' : 'error',
      toolCalls: [],
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      startedAt,
      finishedAt: new Date(),
    });

    console.error('AI plan-week error:', error);
    return res.status(502).json({
      success: false,
      error: { message: 'AI planning is temporarily unavailable' },
    });
  }
});

const knowledgeSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(10).default(3),
});

router.get('/knowledge-search', async (req: AuthRequest, res: Response) => {
  try {
    const { q, limit } = knowledgeSearchQuerySchema.parse(req.query);
    const client = getOpenAIClient();
    const [embedding] = await embedTexts({ client, model: config.openaiEmbeddingModel, texts: [q] });

    if (!embedding) {
      return res.json({ success: true, data: { results: [] } });
    }

    const results = await searchKnowledge(embedding, limit);
    return res.json({ success: true, data: { results } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid input data', details: error.errors },
      });
    }
    if (error instanceof AiNotConfiguredError) {
      return res.status(503).json({ success: false, error: { message: error.message } });
    }

    console.error('Knowledge search error:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

export default router;
