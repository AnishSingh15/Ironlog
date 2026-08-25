import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ai/openaiClient', () => ({
  getOpenAIClient: vi.fn(() => ({})),
}));

vi.mock('../../src/ai/rag/embeddings', () => ({
  embedTexts: vi.fn(async () => [[0.1, 0.2, 0.3]]),
}));

vi.mock('../../src/ai/rag/retrieval', () => ({
  searchKnowledge: vi.fn(async (_embedding: number[], limit: number) =>
    [
      { id: '1', source: 'progressive-overload.md', title: 'Progressive Overload', content: 'text', chunkIndex: 0, score: 0.9 },
    ].slice(0, limit)
  ),
}));

describe('searchFitnessKnowledge tool', () => {
  it('embeds the query then retrieves cited knowledge chunks', async () => {
    const { knowledgeTools } = await import('../../src/ai/tools/knowledgeTools');
    const tool = knowledgeTools.find(t => t.name === 'searchFitnessKnowledge');
    expect(tool).toBeDefined();

    const parsed = tool!.parameters.parse({ query: 'why am I stuck on bench press' });
    const result = (await tool!.handler('user_1', parsed)) as { source: string }[];

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe('progressive-overload.md');
  });

  it('rejects an empty query', async () => {
    const { knowledgeTools } = await import('../../src/ai/tools/knowledgeTools');
    const tool = knowledgeTools.find(t => t.name === 'searchFitnessKnowledge');
    expect(() => tool!.parameters.parse({ query: '' })).toThrow();
  });
});
