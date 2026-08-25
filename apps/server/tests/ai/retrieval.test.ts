import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { searchKnowledge } from '../../src/ai/rag/retrieval';

const prisma = new PrismaClient();

const DIMENSIONS = 1536;

function unitVectorAlong(dimension: number): number[] {
  const vector = new Array(DIMENSIONS).fill(0);
  vector[dimension] = 1;
  return vector;
}

async function insertChunk(params: {
  source: string;
  title: string;
  content: string;
  chunkIndex: number;
  embedding: number[];
}) {
  const vectorLiteral = `[${params.embedding.join(',')}]`;
  await prisma.$executeRaw`
    INSERT INTO knowledge_chunks (id, source, title, content, "chunkIndex", metadata, embedding, "createdAt")
    VALUES (
      ${randomUUID()},
      ${params.source},
      ${params.title},
      ${params.content},
      ${params.chunkIndex},
      ${'{}'}::jsonb,
      ${vectorLiteral}::vector,
      now()
    )
  `;
}

describe('searchKnowledge', () => {
  beforeEach(async () => {
    await prisma.$executeRaw`DELETE FROM knowledge_chunks`;
  });

  afterEach(async () => {
    await prisma.$executeRaw`DELETE FROM knowledge_chunks`;
  });

  it('ranks the chunk with the closest embedding direction first', async () => {
    await insertChunk({
      source: 'near.md',
      title: 'Near',
      content: 'This chunk should rank first.',
      chunkIndex: 0,
      embedding: unitVectorAlong(0),
    });
    await insertChunk({
      source: 'far.md',
      title: 'Far',
      content: 'This chunk should rank second.',
      chunkIndex: 0,
      embedding: unitVectorAlong(1),
    });

    const queryEmbedding = unitVectorAlong(0);
    const results = await searchKnowledge(queryEmbedding, 2);

    expect(results).toHaveLength(2);
    expect(results[0]?.source).toBe('near.md');
    expect(results[0]?.score).toBeCloseTo(1, 5);
    expect(results[1]?.source).toBe('far.md');
    expect(results[1]?.score).toBeCloseTo(0, 5);
  });

  it('respects the limit parameter', async () => {
    await insertChunk({
      source: 'a.md',
      title: 'A',
      content: 'chunk a',
      chunkIndex: 0,
      embedding: unitVectorAlong(0),
    });
    await insertChunk({
      source: 'b.md',
      title: 'B',
      content: 'chunk b',
      chunkIndex: 0,
      embedding: unitVectorAlong(1),
    });

    const results = await searchKnowledge(unitVectorAlong(0), 1);
    expect(results).toHaveLength(1);
  });
});
