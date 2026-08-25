import { describe, expect, it, vi } from 'vitest';
import { embedTexts } from '../../src/ai/rag/embeddings';

describe('embedTexts', () => {
  it('returns embeddings re-ordered to match input order regardless of API response order', async () => {
    const client = {
      embeddings: {
        create: vi.fn(async () => ({
          data: [
            { index: 1, embedding: [0.2, 0.2] },
            { index: 0, embedding: [0.1, 0.1] },
          ],
        })),
      },
    } as any;

    const result = await embedTexts({ client, model: 'text-embedding-3-small', texts: ['a', 'b'] });

    expect(result).toEqual([
      [0.1, 0.1],
      [0.2, 0.2],
    ]);
    expect(client.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['a', 'b'],
    });
  });
});
