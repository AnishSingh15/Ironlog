import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('rejects knowledge-search with a missing query', async () => {
    const { default: app } = await import('../src/index');
    await request(app)
      .get('/api/v1/ai/knowledge-search')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });
});
