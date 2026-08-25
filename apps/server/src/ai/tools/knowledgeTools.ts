import { z } from 'zod';
import { config } from '../../config';
import { getOpenAIClient } from '../openaiClient';
import { embedTexts } from '../rag/embeddings';
import { searchKnowledge } from '../rag/retrieval';
import { defineTool } from './types';

const searchFitnessKnowledgeTool = defineTool({
  name: 'searchFitnessKnowledge',
  description:
    'Semantic search over curated fitness training principles (progressive overload, recovery, ' +
    'volume/frequency, plateaus, safety). Returns cited excerpts with source and relevance score ' +
    '— use this for general training guidance, not for the user\'s personal workout data.',
  parameters: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(10).default(3),
  }),
  handler: async (_userId, args) => {
    const client = getOpenAIClient();
    const [embedding] = await embedTexts({
      client,
      model: config.openaiEmbeddingModel,
      texts: [args.query],
    });
    if (!embedding) {
      return [];
    }
    return searchKnowledge(embedding, args.limit);
  },
});

export const knowledgeTools = [searchFitnessKnowledgeTool];
