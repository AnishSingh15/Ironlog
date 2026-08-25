import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgent } from '../src/ai/agentRunner';

vi.mock('../src/ai/agentRunner', () => ({
  runAgent: vi.fn(async () => ({
    output: {
      summary: 'Bench press is progressing well.',
      recommendations: [
        {
          type: 'progression_recommendation',
          exercise: 'Bench Press',
          action: 'increase_weight',
          recommendedWeightKg: 65,
          targetSets: 3,
          targetReps: '6-8',
          confidence: 0.87,
          evidence: ['last_4_sessions'],
          reasoning: 'Consistent overload.',
        },
      ],
      plateauedExercises: [],
      overallTrend: 'improving',
    },
    toolCalls: [{ name: 'getRecentPerformance', args: { exerciseName: 'Bench Press' } }],
    usage: { promptTokens: 100, completionTokens: 50 },
  })),
  AgentOutputError: class AgentOutputError extends Error {},
}));

vi.mock('../src/ai/agentRunLogger', () => ({
  agentRunLogger: { log: vi.fn(async () => undefined) },
}));

vi.mock('../src/ai/openaiClient', () => ({
  getOpenAIClient: vi.fn(() => ({})),
  AiNotConfiguredError: class AiNotConfiguredError extends Error {},
}));

vi.mock('../src/services/analytics.service', () => ({
  analyticsService: {
    getTrainingFrequency: vi.fn(async () => ({ totalSessions: 4, weeksSpanned: 4, sessionsPerWeek: 1 })),
    getWeeklyVolume: vi.fn(async () => [{ weekStart: new Date(), totalVolume: 1000, sessionCount: 1 }]),
    getMuscleGroupVolume: vi.fn(async () => [{ muscleGroup: 'Chest', totalVolume: 1000 }]),
    getConsistency: vi.fn(async () => 75),
    getWeekCalendar: vi.fn(async () => [{ date: new Date(), status: 'completed' }]),
    getTopPlateauAlert: vi.fn(async () => null),
    getExerciseHistory: vi.fn(async () => [
      { date: new Date('2026-08-01'), actualWeight: 60, actualReps: 8, plannedWeight: 60, plannedReps: 8, setIndex: 0 },
      { date: new Date('2026-08-08'), actualWeight: 62.5, actualReps: 8, plannedWeight: 62.5, plannedReps: 8, setIndex: 0 },
    ]),
    getPlateauScan: vi.fn(async () => [
      { exercise: 'Overhead Press', durationSessions: 4, trend: 'flat', confidence: 0.8, reasoning: 'Over your last 4 sessions...' },
    ]),
    getWeekReview: vi.fn(async () => ({
      sessionsThisWeek: 3,
      volumeThisWeek: 4500,
      volumeLastWeek: 4000,
      volumeChangePct: 12,
      personalRecordsThisWeek: [],
      plateauedExercises: [],
    })),
    getTodayAdaptation: vi.fn(async () => [
      {
        exercise: 'Bench Press',
        setIds: ['set-1'],
        recommendation: {
          action: 'increase_weight',
          recommendedWeightKg: 65,
          targetReps: 8,
          confidence: 0.7,
          evidence: [],
          reasoning: 'Consistent overload.',
        },
      },
    ]),
  },
}));

vi.mock('../src/ai/rag/embeddings', () => ({
  embedTexts: vi.fn(async () => [[0.1, 0.2, 0.3]]),
}));

vi.mock('../src/ai/rag/retrieval', () => ({
  searchKnowledge: vi.fn(async () => [
    {
      id: '1',
      source: 'progressive-overload.md',
      title: 'Progressive Overload',
      content: 'Progress is not linear.',
      chunkIndex: 0,
      score: 0.92,
    },
  ]),
}));

const prisma = new PrismaClient();

describe('AI routes', () => {
  let accessToken: string;

  beforeEach(async () => {
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.user.deleteMany({});

    const { default: app } = await import('../src/index');
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      name: 'AI Test User',
      email: `ai-test-${Date.now()}@example.com`,
      password: 'testpassword123',
    });
    accessToken = registerResponse.body.data.tokens.accessToken;
  });

  afterEach(async () => {
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('rejects analyze-workout without authentication', async () => {
    const { default: app } = await import('../src/index');
    await request(app).post('/api/v1/ai/analyze-workout').expect(401);
  });

  it('returns a schema-valid workout analysis for an authenticated user', async () => {
    const { default: app } = await import('../src/index');
    const response = await request(app)
      .post('/api/v1/ai/analyze-workout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.analysis.overallTrend).toBe('improving');
    expect(response.body.data.analysis.recommendations[0].exercise).toBe('Bench Press');
  });

  it('returns a live-computed fitness state summary', async () => {
    const { default: app } = await import('../src/index');
    const response = await request(app)
      .get('/api/v1/ai/fitness-state')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.trainingFrequency.totalSessions).toBe(4);
  });

  it('returns cited knowledge chunks for a search query', async () => {
    const { default: app } = await import('../src/index');
    const response = await request(app)
      .get('/api/v1/ai/knowledge-search')
      .query({ q: 'why am I stuck on bench press' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.results[0].source).toBe('progressive-overload.md');
  });

  it('returns a deterministic exercise recommendation with no LLM call', async () => {
    await prisma.exercise.upsert({
      where: { name: 'Bench Press' },
      update: {},
      create: { name: 'Bench Press', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 8 },
    });

    const { default: app } = await import('../src/index');
    const response = await request(app)
      .get('/api/v1/ai/exercise-recommendation')
      .query({ exercise: 'Bench Press' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.recommendation.action).toBeDefined();
    expect(response.body.data.recommendation.evidence).toBeDefined();
  });

  it('rejects exercise-recommendation with a missing exercise param', async () => {
    const { default: app } = await import('../src/index');
    await request(app)
      .get('/api/v1/ai/exercise-recommendation')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('returns a deterministic plateau scan for why-stuck', async () => {
    const { default: app } = await import('../src/index');
    const response = await request(app)
      .get('/api/v1/ai/why-stuck')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.plateaus[0].exercise).toBe('Overhead Press');
  });

  it('returns a deterministic week review', async () => {
    const { default: app } = await import('../src/index');
    const response = await request(app)
      .get('/api/v1/ai/week-review')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.review.sessionsThisWeek).toBe(3);
  });

  it('returns deterministic adaptations for today', async () => {
    const { default: app } = await import('../src/index');
    const response = await request(app)
      .get('/api/v1/ai/adapt-today')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.adaptations[0].exercise).toBe('Bench Press');
  });

  it('rejects knowledge-search with a missing query', async () => {
    const { default: app } = await import('../src/index');
    await request(app)
      .get('/api/v1/ai/knowledge-search')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('returns a schema-valid 7-day plan for an authenticated user', async () => {
    const weekdays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ] as const;

    vi.mocked(runAgent).mockResolvedValueOnce({
      output: {
        goal: 'Build strength',
        summary: 'Three training days with adequate recovery between them.',
        sessions: weekdays.map(day => ({
          day,
          focus: ['Monday', 'Wednesday', 'Friday'].includes(day) ? 'Full Body' : 'Rest',
          isRestDay: !['Monday', 'Wednesday', 'Friday'].includes(day),
          exercises: ['Monday', 'Wednesday', 'Friday'].includes(day)
            ? [{ name: 'Bench Press', targetSets: 3, targetReps: '6-8' }]
            : [],
          reasoning: 'Alternating training and rest days for recovery.',
        })),
      },
      toolCalls: [{ name: 'getTrainingFrequency', args: {} }],
      usage: { promptTokens: 120, completionTokens: 80 },
    });

    const { default: app } = await import('../src/index');
    const response = await request(app)
      .post('/api/v1/ai/plan-week')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ goal: 'Build strength', availableDays: ['Monday', 'Wednesday', 'Friday'] })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.plan.sessions).toHaveLength(7);
    expect(response.body.data.plan.sessions[0].day).toBe('Monday');
  });

  it('rejects plan-week with an invalid day name', async () => {
    const { default: app } = await import('../src/index');
    await request(app)
      .post('/api/v1/ai/plan-week')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ availableDays: ['Funday'] })
      .expect(400);
  });
});
