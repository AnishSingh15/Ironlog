import { Response, Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { AgentOutputError, runAgent } from '../ai/agentRunner';
import { agentRunLogger } from '../ai/agentRunLogger';
import { AiNotConfiguredError, getOpenAIClient } from '../ai/openaiClient';
import { analyticsTools } from '../ai/tools/analyticsTools';
import { progressionTools } from '../ai/tools/progressionTools';
import { plateauTools } from '../ai/tools/plateauTools';
import { workoutAnalysisSchema } from '../ai/schemas/workoutAnalysis';
import { analyticsService } from '../services/analytics.service';

const router = Router();
router.use(authenticate);

const coachTools = [...analyticsTools, ...progressionTools, ...plateauTools];

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
Never invent numbers you did not get from a tool call. If there is not enough data, say so and use
"insufficient_data". You are not a doctor: if the user mentions pain, injury, or medical symptoms,
tell them to consult a qualified professional instead of diagnosing anything.`;

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
    const [trainingFrequency, weeklyVolume] = await Promise.all([
      analyticsService.getTrainingFrequency(userId, 8),
      analyticsService.getWeeklyVolume(userId, 8),
    ]);

    return res.json({ success: true, data: { trainingFrequency, weeklyVolume } });
  } catch (error) {
    console.error('Fitness state error:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

export default router;
