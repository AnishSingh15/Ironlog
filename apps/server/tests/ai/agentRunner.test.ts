import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { AgentOutputError, runAgent } from '../../src/ai/agentRunner';
import { defineTool } from '../../src/ai/tools/types';

function fakeClient(responses: unknown[]) {
  let call = 0;
  return {
    chat: {
      completions: {
        create: vi.fn(async () => {
          const response = responses[call];
          call += 1;
          return response;
        }),
      },
    },
  } as any;
}

const echoTool = defineTool({
  name: 'echoNumber',
  description: 'Echoes a number back',
  parameters: z.object({ value: z.number() }),
  handler: async (_userId, args) => ({ echoed: args.value }),
});

const outputSchema = z.object({ summary: z.string(), echoedValue: z.number() });

describe('runAgent', () => {
  it('executes a tool call then returns validated structured output', async () => {
    const client = fakeClient([
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'echoNumber', arguments: JSON.stringify({ value: 42 }) },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      },
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({ summary: 'done', echoedValue: 42 }),
              tool_calls: undefined,
            },
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 8 },
      },
    ]);

    const result = await runAgent({
      client,
      userId: 'user_1',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a test agent. Reply with JSON.',
      userMessage: 'Echo 42',
      tools: [echoTool],
      outputSchema,
    });

    expect(result.output).toEqual({ summary: 'done', echoedValue: 42 });
    expect(result.toolCalls).toEqual([{ name: 'echoNumber', args: { value: 42 } }]);
    expect(result.usage).toEqual({ promptTokens: 30, completionTokens: 13 });
  });

  it('never lets the tool see or override userId', async () => {
    let receivedUserId: string | null = null;
    const spyTool = defineTool({
      name: 'spy',
      description: 'records the userId it was called with',
      parameters: z.object({}),
      handler: async userId => {
        receivedUserId = userId;
        return { ok: true };
      },
    });

    const client = fakeClient([
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  // model tries to smuggle a different userId in — must be ignored
                  function: { name: 'spy', arguments: JSON.stringify({ userId: 'attacker' }) },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
      {
        choices: [
          { message: { role: 'assistant', content: JSON.stringify({ summary: 'ok', echoedValue: 0 }) } },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    ]);

    await runAgent({
      client,
      userId: 'real-user',
      model: 'gpt-4o-mini',
      systemPrompt: 'test',
      userMessage: 'test',
      tools: [spyTool],
      outputSchema,
    });

    expect(receivedUserId).toBe('real-user');
  });

  it('throws AgentOutputError when the final content is not valid JSON', async () => {
    const client = fakeClient([
      { choices: [{ message: { role: 'assistant', content: 'not json' } }], usage: {} },
    ]);

    await expect(
      runAgent({
        client,
        userId: 'user_1',
        model: 'gpt-4o-mini',
        systemPrompt: 'test',
        userMessage: 'test',
        tools: [],
        outputSchema,
      })
    ).rejects.toThrow(AgentOutputError);
  });

  it('throws AgentOutputError when output fails schema validation', async () => {
    const client = fakeClient([
      {
        choices: [{ message: { role: 'assistant', content: JSON.stringify({ wrong: 'shape' }) } }],
        usage: {},
      },
    ]);

    await expect(
      runAgent({
        client,
        userId: 'user_1',
        model: 'gpt-4o-mini',
        systemPrompt: 'test',
        userMessage: 'test',
        tools: [],
        outputSchema,
      })
    ).rejects.toThrow(AgentOutputError);
  });
});
