import type OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { AnyToolDefinition } from './tools/types';

const MAX_ITERATIONS = 6;

export class AgentOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentOutputError';
  }
}

export interface RunAgentParams<Output> {
  client: Pick<OpenAI, 'chat'>;
  userId: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  tools: AnyToolDefinition[];
  outputSchema: z.ZodType<Output>;
}

export interface RunAgentResult<Output> {
  output: Output;
  toolCalls: { name: string; args: unknown }[];
  usage: { promptTokens: number; completionTokens: number };
}

export async function runAgent<Output>(
  params: RunAgentParams<Output>
): Promise<RunAgentResult<Output>> {
  const toolsByName = new Map(params.tools.map(tool => [tool.name, tool]));
  const chatTools: ChatCompletionTool[] = params.tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters, { target: 'openApi3' }) as Record<
        string,
        unknown
      >,
    },
  }));

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: params.systemPrompt },
    { role: 'user', content: params.userMessage },
  ];

  const toolCalls: { name: string; args: unknown }[] = [];
  let promptTokens = 0;
  let completionTokens = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const isLastChance = iteration === MAX_ITERATIONS - 1;
    const completion = await params.client.chat.completions.create({
      model: params.model,
      messages,
      ...(isLastChance ? {} : { tools: chatTools }),
      // JSON mode only constrains the assistant's plain-text content, not tool calls, so
      // it's safe (and necessary) on every iteration - restricting it to just the last
      // chance let the model wrap its final answer in markdown fences or add commentary
      // on any earlier iteration where it decided to answer directly instead of calling
      // another tool, which JSON.parse below then rejected outright.
      response_format: { type: 'json_object' as const },
    });

    promptTokens += completion.usage?.prompt_tokens ?? 0;
    completionTokens += completion.usage?.completion_tokens ?? 0;

    const choice = completion.choices[0];
    if (!choice) {
      throw new AgentOutputError('AI returned no choices');
    }
    const message = choice.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      messages.push(message);
      for (const call of message.tool_calls) {
        if (call.type !== 'function') {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Unsupported tool call type ${call.type}` }),
          });
          continue;
        }

        const tool = toolsByName.get(call.function.name);
        if (!tool) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Unknown tool ${call.function.name}` }),
          });
          continue;
        }

        let parsedArgs: unknown;
        try {
          parsedArgs = JSON.parse(call.function.arguments);
        } catch {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: 'Invalid JSON arguments' }),
          });
          continue;
        }

        const validated = tool.parameters.safeParse(parsedArgs);
        if (!validated.success) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: validated.error.message }),
          });
          continue;
        }

        toolCalls.push({ name: tool.name, args: validated.data });
        try {
          const result = await tool.handler(params.userId, validated.data);
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        } catch (err) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              error: err instanceof Error ? err.message : 'Tool execution failed',
            }),
          });
        }
      }
      continue;
    }

    if (!message.content) {
      throw new AgentOutputError('AI returned empty content');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(message.content);
    } catch {
      throw new AgentOutputError('AI did not return valid JSON');
    }

    const result = params.outputSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new AgentOutputError(`AI output failed schema validation: ${result.error.message}`);
    }

    return { output: result.data, toolCalls, usage: { promptTokens, completionTokens } };
  }

  throw new AgentOutputError('AI agent exceeded maximum tool-call iterations');
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface RunChatAgentParams {
  client: Pick<OpenAI, 'chat'>;
  userId: string;
  model: string;
  systemPrompt: string;
  history: ChatTurn[];
  tools: AnyToolDefinition[];
}

export interface RunChatAgentResult {
  reply: string;
  toolCalls: { name: string; args: unknown }[];
  usage: { promptTokens: number; completionTokens: number };
}

// Separate from runAgent rather than a shared code path: runAgent enforces a JSON
// schema on the final answer (analyze-workout, plan-week, ...) and only takes a single
// user turn. Chat needs the opposite on both counts - free-text replies and a full
// multi-turn history - so it gets its own copy of the tool-calling loop rather than
// bolting optional modes onto the already-tested structured-output path.
export async function runChatAgent(params: RunChatAgentParams): Promise<RunChatAgentResult> {
  const toolsByName = new Map(params.tools.map(tool => [tool.name, tool]));
  const chatTools: ChatCompletionTool[] = params.tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters, { target: 'openApi3' }) as Record<
        string,
        unknown
      >,
    },
  }));

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: params.systemPrompt },
    ...params.history.map((turn): ChatCompletionMessageParam => ({ role: turn.role, content: turn.content })),
  ];

  const toolCalls: { name: string; args: unknown }[] = [];
  let promptTokens = 0;
  let completionTokens = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const isLastChance = iteration === MAX_ITERATIONS - 1;
    const completion = await params.client.chat.completions.create({
      model: params.model,
      messages,
      ...(isLastChance ? {} : { tools: chatTools }),
    });

    promptTokens += completion.usage?.prompt_tokens ?? 0;
    completionTokens += completion.usage?.completion_tokens ?? 0;

    const choice = completion.choices[0];
    if (!choice) {
      throw new AgentOutputError('AI returned no choices');
    }
    const message = choice.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      messages.push(message);
      for (const call of message.tool_calls) {
        if (call.type !== 'function') {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Unsupported tool call type ${call.type}` }),
          });
          continue;
        }

        const tool = toolsByName.get(call.function.name);
        if (!tool) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Unknown tool ${call.function.name}` }),
          });
          continue;
        }

        let parsedArgs: unknown;
        try {
          parsedArgs = JSON.parse(call.function.arguments);
        } catch {
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: 'Invalid JSON arguments' }) });
          continue;
        }

        const validated = tool.parameters.safeParse(parsedArgs);
        if (!validated.success) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: validated.error.message }),
          });
          continue;
        }

        toolCalls.push({ name: tool.name, args: validated.data });
        try {
          const result = await tool.handler(params.userId, validated.data);
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        } catch (err) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' }),
          });
        }
      }
      continue;
    }

    if (!message.content) {
      throw new AgentOutputError('AI returned empty content');
    }

    return { reply: message.content, toolCalls, usage: { promptTokens, completionTokens } };
  }

  throw new AgentOutputError('AI agent exceeded maximum tool-call iterations');
}
