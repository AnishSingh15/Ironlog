import OpenAI from 'openai';
import { config } from '../config';

export class AiNotConfiguredError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not configured. AI features are unavailable.');
    this.name = 'AiNotConfiguredError';
  }
}

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!config.openaiApiKey) {
    throw new AiNotConfiguredError();
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return cachedClient;
}
