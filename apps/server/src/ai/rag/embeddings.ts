import type OpenAI from 'openai';

export interface EmbedTextsParams {
  client: Pick<OpenAI, 'embeddings'>;
  model: string;
  texts: string[];
}

export async function embedTexts(params: EmbedTextsParams): Promise<number[][]> {
  const response = await params.client.embeddings.create({
    model: params.model,
    input: params.texts,
  });

  return response.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding);
}
