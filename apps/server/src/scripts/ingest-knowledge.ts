import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { getOpenAIClient } from '../ai/openaiClient';
import { chunkMarkdown } from '../ai/rag/chunker';
import { embedTexts } from '../ai/rag/embeddings';

const prisma = new PrismaClient();
const KNOWLEDGE_DIR = join(__dirname, '../ai/knowledge');

async function ingestFile(file: string): Promise<number> {
  const markdown = readFileSync(join(KNOWLEDGE_DIR, file), 'utf-8');
  const chunks = chunkMarkdown(file, markdown);

  const embeddings = await embedTexts({
    client: getOpenAIClient(),
    model: config.openaiEmbeddingModel,
    texts: chunks.map(chunk => chunk.content),
  });

  await prisma.$executeRaw`DELETE FROM knowledge_chunks WHERE source = ${file}`;

  for (const [i, chunk] of chunks.entries()) {
    const embedding = embeddings[i];
    if (!embedding) continue;
    const vectorLiteral = `[${embedding.join(',')}]`;
    const metadata = JSON.stringify({ totalChunks: chunks.length });

    await prisma.$executeRaw`
      INSERT INTO knowledge_chunks (id, source, title, content, "chunkIndex", metadata, embedding, "createdAt")
      VALUES (
        ${randomUUID()},
        ${chunk.source},
        ${chunk.title},
        ${chunk.content},
        ${chunk.chunkIndex},
        ${metadata}::jsonb,
        ${vectorLiteral}::vector,
        now()
      )
    `;
  }

  return chunks.length;
}

async function main() {
  const files = readdirSync(KNOWLEDGE_DIR).filter(file => file.endsWith('.md'));

  for (const file of files) {
    const chunkCount = await ingestFile(file);
    console.log(`Ingested ${chunkCount} chunk(s) from ${file}`);
  }

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Knowledge ingestion failed:', error);
  process.exit(1);
});
