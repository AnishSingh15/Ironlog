import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getOpenAIClient', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
    vi.resetModules();
  });

  it('throws AiNotConfiguredError when OPENAI_API_KEY is unset', async () => {
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
    const { getOpenAIClient, AiNotConfiguredError } = await import('../../src/ai/openaiClient');
    expect(() => getOpenAIClient()).toThrow(AiNotConfiguredError);
  });

  it('returns a client instance when OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    vi.resetModules();
    const { getOpenAIClient } = await import('../../src/ai/openaiClient');
    const client = getOpenAIClient();
    expect(client).toBeDefined();
    expect(client.chat).toBeDefined();
  });

  it('reuses the same client instance across calls', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    vi.resetModules();
    const { getOpenAIClient } = await import('../../src/ai/openaiClient');
    expect(getOpenAIClient()).toBe(getOpenAIClient());
  });
});
