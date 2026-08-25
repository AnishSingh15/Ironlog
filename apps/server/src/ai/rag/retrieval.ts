import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface KnowledgeMatch {
  id: string;
  source: string;
  title: string;
  content: string;
  chunkIndex: number;
  score: number;
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function searchKnowledge(embedding: number[], limit = 3): Promise<KnowledgeMatch[]> {
  const vectorLiteral = toVectorLiteral(embedding);

  return prisma.$queryRaw<KnowledgeMatch[]>`
    SELECT
      id,
      source,
      title,
      content,
      "chunkIndex" AS "chunkIndex",
      1 - (embedding <=> ${vectorLiteral}::vector) AS score
    FROM knowledge_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;
}
