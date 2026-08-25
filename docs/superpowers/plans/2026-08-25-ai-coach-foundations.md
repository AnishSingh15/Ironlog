# AI Training Coach — Phases 1-3 (Foundations, Analytics Tools, Structured Insights) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give IronLog's Express server a tool-using AI agent foundation — OpenAI client, Zod-validated tool contracts, deterministic analytics/progression/plateau engines, and the first real agent-backed endpoint (`POST /api/v1/ai/analyze-workout`) — without touching any existing route, model, or frontend behavior.

**Architecture:** LLM reasoning (OpenAI) is isolated behind a hand-rolled tool-call loop (`apps/server/src/ai/agentRunner.ts`) that only ever emits Zod-validated structured output; all data access happens through deterministic domain services (`analytics.service.ts`, `progression.ts`, `plateau.ts`) that the agent can only reach via typed tools scoped to the authenticated `userId`. The LLM never writes to the database directly — these three phases are entirely read/analysis, no mutation tools yet (those come in a later phase). RAG/pgvector is *not* part of this plan — it lands in Phase 4.

**Tech Stack:** `openai` npm SDK (chat completions + embeddings, both OpenAI), `zod` (already a dependency) for every tool input/output and the final structured response, `zod-to-json-schema` (new dependency — converts the same Zod schema used for runtime validation into the JSON Schema OpenAI's `tools` API requires, so there is one source of truth per tool contract instead of hand-maintained duplicates), Prisma (existing), Vitest + Supertest (existing, following `apps/server/tests/auth.test.ts` conventions).

**Spec:** The user's full 31-section brief in this conversation (no separate file — the brief itself is the spec; this plan implements sections 1, 3, 4, 6 (read tools only), 7, 8 (schema only, live-computed), 12, 13, 20 (partial), 22 (partial), 24, 25, 26 of it). Sections 5, 9-11, 14-19, 21, 23, 27-30 are explicitly deferred to later phases (4-12) per the phase breakdown already agreed with the user.

## Global Constraints

- OpenAI is the only LLM/embeddings provider for this and all future AI phases (user decision — key will be supplied later; code must fail with a clear, caught error if `OPENAI_API_KEY` is unset, never crash the process at import time).
- The LLM must never receive or set `userId` — every tool handler takes `userId` as a parameter injected by the orchestrator from the authenticated request, never from model-generated arguments or request body (brief section 20/25).
- No raw LLM output reaches the database or the HTTP response without passing a Zod `outputSchema.parse()` (brief section 7).
- CI/tests must never require a live `OPENAI_API_KEY` — all OpenAI calls in tests use an injected fake client (brief section 24).
- Existing routes, Prisma models, and frontend must remain untouched and working.
- New server code follows existing conventions: class-based services exported as a singleton (see `WorkoutService`/`workoutService`), Express routers mounted under `/api/v1/...`, `{ success, data }` / `{ success: false, error: { message } }` response envelopes, `authenticate` middleware + `AuthRequest`.
- Server `tsconfig.json` has `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters` — all new code must satisfy these (verified with `npx tsc -p apps/server/tsconfig.json --noEmit`, since the `type-check` npm script is currently stubbed to a no-op and must not be relied on).

---

## File Structure

```
apps/server/src/
  ai/
    openaiClient.ts          # lazy OpenAI client factory, throws AiNotConfiguredError if no key
    agentRunner.ts           # generic tool-call loop: messages -> tools -> validated structured output
    agentRunLogger.ts        # writes AgentRun rows (observability, section 22)
    tools/
      types.ts               # ToolDefinition<Params, Result> + defineTool()
      analyticsTools.ts       # wraps analytics.service.ts as agent tools
      progressionTools.ts     # wraps progression.ts as an agent tool
      plateauTools.ts         # wraps plateau.ts as an agent tool
    schemas/
      workoutAnalysis.ts      # Zod schema for the analyze-workout structured output
  services/
    analytics.service.ts      # deterministic read-only queries (Phase 2)
    progression.ts             # deterministic progression engine (Phase 2)
    plateau.ts                  # deterministic plateau detector (Phase 2)
  routes/
    ai.ts                      # POST /api/v1/ai/analyze-workout, GET /api/v1/ai/fitness-state
apps/server/prisma/
  schema.prisma                # + FitnessState, CoachMemory, KnowledgeChunk, AgentRun models
apps/server/tests/
  ai/
    agentRunner.test.ts
    analytics.service.test.ts
    progression.test.ts
    plateau.test.ts
    ai.routes.test.ts
```

Each new file has one responsibility: `openaiClient` only constructs the SDK client, `agentRunner` only runs the loop, `tools/*` only adapt services to the tool contract, `services/*` only query/compute — no route ever calls Prisma directly for AI features, matching (but not refactoring) the existing pattern where `workout.service.ts` is the only thing that touches `WorkoutDay`/`SetRecord` for its domain.

---

### Task 1: OpenAI dependency, env config, and the lazy client wrapper

**Files:**
- Modify: `apps/server/package.json` (add `openai`, `zod-to-json-schema` deps)
- Modify: `apps/server/src/config.ts`
- Modify: `apps/server/.env.example`
- Modify: `.env.production.example`
- Create: `apps/server/src/ai/openaiClient.ts`
- Test: `apps/server/tests/ai/openaiClient.test.ts`

**Interfaces:**
- Produces: `config.openaiApiKey: string | undefined`, `config.openaiModel: string`, `config.openaiEmbeddingModel: string`; `getOpenAIClient(): OpenAI` and `class AiNotConfiguredError extends Error` from `openaiClient.ts`, used by every later task that needs the SDK.

- [ ] **Step 1: Add dependencies**

```bash
cd apps/server && pnpm add openai zod-to-json-schema
```

- [ ] **Step 2: Extend config**

Edit `apps/server/src/config.ts` to add the three new fields without touching existing ones:

```ts
export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://ironlog:password@localhost:5432/ironlog',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
};
```

- [ ] **Step 3: Document the env vars**

Append to `apps/server/.env.example`:

```
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

Append the same three lines (with production-appropriate comments) under a new `# AI Configuration` heading in `.env.production.example`.

- [ ] **Step 4: Write the failing test for the client wrapper**

Create `apps/server/tests/ai/openaiClient.test.ts`:

```ts
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
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd apps/server && npx vitest run tests/ai/openaiClient.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/openaiClient'`

- [ ] **Step 6: Implement the client wrapper**

Create `apps/server/src/ai/openaiClient.ts`:

```ts
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/server && npx vitest run tests/ai/openaiClient.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Type-check**

Run: `npx tsc -p apps/server/tsconfig.json --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add apps/server/package.json apps/server/pnpm-lock.yaml apps/server/src/config.ts apps/server/.env.example .env.production.example apps/server/src/ai/openaiClient.ts apps/server/tests/ai/openaiClient.test.ts
git commit -m "feat(ai): add OpenAI client wrapper and config"
```

---

### Task 2: Prisma schema additions (FitnessState, CoachMemory, KnowledgeChunk, AgentRun)

**Files:**
- Modify: `apps/server/prisma/schema.prisma`
- Modify: `docker-compose.yml` (swap `postgres:15-alpine` → `pgvector/pgvector:pg15`, same image behavior, adds the extension binary)
- Create: `apps/server/prisma/migrations/<timestamp>_add_ai_models/migration.sql` (via `prisma migrate dev`, then hand-append the extension statement)

**Interfaces:**
- Produces: Prisma models `FitnessState`, `CoachMemory`, `KnowledgeChunk`, `AgentRun` and their generated Prisma Client types, used by `agentRunLogger.ts` (Task 3) and the RAG plan (Phase 4, not in this plan).

- [ ] **Step 1: Swap the local Postgres image so pgvector is available**

Edit `docker-compose.yml`, change only the `postgres.image` line:

```yaml
    image: pgvector/pgvector:pg15
```

(This image is a drop-in for `postgres:15-alpine` with the `vector` extension binary pre-installed; no other docker-compose fields change.)

- [ ] **Step 2: Add the new models to the schema**

Edit `apps/server/prisma/schema.prisma`. First, enable the Postgres extensions preview feature and declare the `vector` extension — modify the existing `generator` and `datasource` blocks:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}
```

Then append these four models at the end of the file:

```prisma
model FitnessState {
  id                     String   @id @default(cuid())
  userId                 String   @unique
  goals                  Json?
  trainingExperience     String?
  currentProgram         String?
  weeklyVolume           Json?
  trainingFrequency      Float?
  consistencyScore       Float?
  progressingExercises   String[]
  stalledExercises       String[]
  recentPerformanceTrend String?
  recoverySignals        Json?
  preferredExercises     String[]
  dislikedExercises      String[]
  preferredSessionDuration Int?
  equipment              String[]
  updatedAt              DateTime @updatedAt
  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("fitness_states")
}

enum CoachMemoryType {
  GOAL
  PREFERENCE
  CONSTRAINT
  FACT
}

model CoachMemory {
  id         String          @id @default(cuid())
  userId     String
  type       CoachMemoryType
  content    String
  source     String
  confidence Float?
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
  expiresAt  DateTime?
  user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type])
  @@map("coach_memories")
}

model KnowledgeChunk {
  id         String                       @id @default(cuid())
  source     String
  title      String
  content    String
  chunkIndex Int
  metadata   Json
  embedding  Unsupported("vector(1536)")?
  createdAt  DateTime                     @default(now())

  @@map("knowledge_chunks")
}

model AgentRun {
  id               String    @id @default(cuid())
  userId           String
  workflow         String
  model            String
  status           String
  toolCalls        Json
  tokensPrompt     Int?
  tokensCompletion Int?
  errorMessage     String?
  userAccepted     Boolean?
  startedAt        DateTime
  finishedAt       DateTime
  createdAt        DateTime  @default(now())
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, workflow])
  @@map("agent_runs")
}
```

Add the four back-reference fields to the existing `User` model (do not touch anything else in it):

```prisma
model User {
  id           String       @id @default(cuid())
  name         String
  email        String       @unique
  passwordHash String
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  workoutDays  WorkoutDay[]
  fitnessState FitnessState?
  coachMemories CoachMemory[]
  agentRuns    AgentRun[]

  @@map("users")
}
```

- [ ] **Step 3: Start Postgres and generate the migration**

Run: `docker compose up -d postgres` (wait for healthy: `docker compose ps`)
Run: `cd apps/server && npx prisma migrate dev --name add_ai_models --create-only`

- [ ] **Step 4: Hand-edit the generated migration to create the extension before the table that uses it**

Open the newly created `apps/server/prisma/migrations/<timestamp>_add_ai_models/migration.sql` and insert this line as the very first statement in the file (Prisma's `Unsupported` type does not generate the `CREATE EXTENSION` statement itself):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 5: Apply the migration**

Run: `cd apps/server && npx prisma migrate dev`
Expected: migration applies cleanly, `npx prisma generate` runs automatically as a post-step.

- [ ] **Step 6: Verify the generated client has the new models**

Run: `cd apps/server && npx tsc -p tsconfig.json --noEmit`
Expected: no errors (confirms `@prisma/client` regenerated with `FitnessState`, `CoachMemory`, `KnowledgeChunk`, `AgentRun` types).

- [ ] **Step 7: Commit**

```bash
git add apps/server/prisma docker-compose.yml
git commit -m "feat(db): add FitnessState, CoachMemory, KnowledgeChunk, AgentRun models and pgvector extension"
```

---

### Task 3: Tool contract type and the generic agent runner loop

**Files:**
- Create: `apps/server/src/ai/tools/types.ts`
- Create: `apps/server/src/ai/agentRunner.ts`
- Create: `apps/server/src/ai/agentRunLogger.ts`
- Test: `apps/server/tests/ai/agentRunner.test.ts`

**Interfaces:**
- Consumes: `getOpenAIClient` from Task 1 (only used by callers of `runAgent`, not by `agentRunner.ts` itself — the OpenAI client is passed in as a parameter so tests can inject a fake one).
- Produces: `ToolDefinition<Params, Result>` and `defineTool()` from `types.ts`; `runAgent()` and `AgentOutputError` from `agentRunner.ts`, used by every tool file (Task 4) and the `ai.ts` route (Task 6).

- [ ] **Step 1: Define the tool contract**

Create `apps/server/src/ai/tools/types.ts`:

```ts
import { z } from 'zod';

export interface ToolDefinition<Params extends z.ZodTypeAny, Result> {
  name: string;
  description: string;
  parameters: Params;
  handler: (userId: string, args: z.infer<Params>) => Promise<Result>;
}

export function defineTool<Params extends z.ZodTypeAny, Result>(
  def: ToolDefinition<Params, Result>
): ToolDefinition<Params, Result> {
  return def;
}
```

- [ ] **Step 2: Write the failing test for the runner**

Create `apps/server/tests/ai/agentRunner.test.ts`. This test injects a fake OpenAI client (no network, no API key needed) so it exercises the full tool-call loop deterministically:

```ts
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { runAgent, AgentOutputError } from '../../src/ai/agentRunner';
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/server && npx vitest run tests/ai/agentRunner.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/agentRunner'`

- [ ] **Step 4: Implement the agent runner**

Create `apps/server/src/ai/agentRunner.ts`:

```ts
import type OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition } from './tools/types';

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
  tools: ToolDefinition<z.ZodTypeAny, unknown>[];
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
      parameters: zodToJsonSchema(tool.parameters, { target: 'openApi3' }) as Record<string, unknown>,
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
      ...(isLastChance ? { response_format: { type: 'json_object' as const } } : {}),
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
```

Note: `params.tools` is typed as `ToolDefinition<z.ZodTypeAny, unknown>[]` for storage, but individual tool files (Task 4) build their tools with concrete Zod types via `defineTool` and pass arrays into `runAgent` — TypeScript structurally widens this fine since `ToolDefinition` is only read from, never contravariantly called by external code.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/server && npx vitest run tests/ai/agentRunner.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Implement the observability logger**

Create `apps/server/src/ai/agentRunLogger.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AgentRunLogEntry {
  userId: string;
  workflow: string;
  model: string;
  status: 'success' | 'error' | 'validation_failed';
  toolCalls: { name: string; args: unknown }[];
  tokensPrompt?: number;
  tokensCompletion?: number;
  errorMessage?: string;
  startedAt: Date;
  finishedAt: Date;
}

export const agentRunLogger = {
  async log(entry: AgentRunLogEntry): Promise<void> {
    await prisma.agentRun.create({
      data: {
        userId: entry.userId,
        workflow: entry.workflow,
        model: entry.model,
        status: entry.status,
        toolCalls: entry.toolCalls,
        tokensPrompt: entry.tokensPrompt ?? null,
        tokensCompletion: entry.tokensCompletion ?? null,
        errorMessage: entry.errorMessage ?? null,
        startedAt: entry.startedAt,
        finishedAt: entry.finishedAt,
      },
    });
  },
};
```

This is deliberately a thin, separately-callable logger (not built into `agentRunner.ts`) so `agentRunner` stays a pure function with no DB dependency and stays trivially unit-testable with a fake client, as proven in Step 2. The `ai.ts` route (Task 6) calls both `runAgent` and `agentRunLogger.log` explicitly.

- [ ] **Step 7: Type-check**

Run: `npx tsc -p apps/server/tsconfig.json --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/ai/tools/types.ts apps/server/src/ai/agentRunner.ts apps/server/src/ai/agentRunLogger.ts apps/server/tests/ai/agentRunner.test.ts
git commit -m "feat(ai): add generic tool-call agent runner and observability logger"
```

---

### Task 4: Deterministic analytics service (read-only queries)

**Files:**
- Create: `apps/server/src/services/analytics.service.ts`
- Test: `apps/server/tests/analytics.service.test.ts`

**Interfaces:**
- Consumes: Prisma models `WorkoutDay`, `SetRecord`, `Exercise` (existing schema, unchanged).
- Produces: `analyticsService` singleton with `getWorkoutHistory`, `getRecentWorkout`, `getExerciseHistory`, `getWeeklyVolume`, `getTrainingFrequency`, `getRecentPerformance` — consumed by `analyticsTools.ts` (Task 6) and `progression.ts`/`plateau.ts` (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `apps/server/tests/analytics.service.test.ts`. This follows the existing `tests/auth.test.ts` pattern of hitting a real Postgres test database via Prisma directly (no mocking of the DB layer, consistent with how `WorkoutService` is exercised today):

```ts
import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyticsService } from '../src/services/analytics.service';

const prisma = new PrismaClient();

async function seedUserWithSets() {
  const user = await prisma.user.create({
    data: { name: 'Analytics User', email: `analytics-${Date.now()}@example.com`, passwordHash: 'x' },
  });
  const exercise = await prisma.exercise.upsert({
    where: { name: 'Bench Press' },
    update: {},
    create: { name: 'Bench Press', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 8 },
  });

  const dates = [
    new Date('2026-08-01T00:00:00.000Z'),
    new Date('2026-08-04T00:00:00.000Z'),
    new Date('2026-08-08T00:00:00.000Z'),
  ];

  for (const [i, date] of dates.entries()) {
    const day = await prisma.workoutDay.create({
      data: { userId: user.id, date, completed: true },
    });
    await prisma.setRecord.createMany({
      data: [
        {
          workoutDayId: day.id,
          exerciseId: exercise.id,
          setIndex: 1,
          plannedWeight: 60,
          plannedReps: 8,
          actualWeight: 60 + i * 2.5,
          actualReps: 8,
          secondsRest: 90,
        },
      ],
    });
  }

  return { user, exercise };
}

describe('analyticsService', () => {
  beforeEach(async () => {
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.exercise.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterEach(async () => {
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.exercise.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('getRecentWorkout returns only the calling user\'s most recent workout', async () => {
    const { user } = await seedUserWithSets();
    const otherUser = await prisma.user.create({
      data: { name: 'Other', email: `other-${Date.now()}@example.com`, passwordHash: 'x' },
    });

    const recent = await analyticsService.getRecentWorkout(user.id);
    expect(recent?.userId).toBe(user.id);

    const otherRecent = await analyticsService.getRecentWorkout(otherUser.id);
    expect(otherRecent).toBeNull();
  });

  it('getExerciseHistory returns sets ordered oldest to newest', async () => {
    const { user } = await seedUserWithSets();
    const history = await analyticsService.getExerciseHistory(user.id, 'Bench Press');
    expect(history).toHaveLength(3);
    expect(history[0]?.actualWeight).toBe(60);
    expect(history[2]?.actualWeight).toBe(65);
  });

  it('getWeeklyVolume sums actualWeight * actualReps per ISO week', async () => {
    const { user } = await seedUserWithSets();
    const volume = await analyticsService.getWeeklyVolume(user.id, 8);
    const totalVolume = volume.reduce((sum, week) => sum + week.totalVolume, 0);
    expect(totalVolume).toBeCloseTo(60 * 8 + 62.5 * 8 + 65 * 8);
  });

  it('getTrainingFrequency counts completed workout days per week', async () => {
    const { user } = await seedUserWithSets();
    const frequency = await analyticsService.getTrainingFrequency(user.id, 8);
    expect(frequency.totalSessions).toBe(3);
  });

  it('getRecentPerformance returns the last N sessions for an exercise', async () => {
    const { user } = await seedUserWithSets();
    const performance = await analyticsService.getRecentPerformance(user.id, 'Bench Press', 2);
    expect(performance).toHaveLength(2);
    expect(performance[0]?.actualWeight).toBe(62.5);
    expect(performance[1]?.actualWeight).toBe(65);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run tests/analytics.service.test.ts`
Expected: FAIL — `Cannot find module '../src/services/analytics.service'`

- [ ] **Step 3: Implement the service**

Create `apps/server/src/services/analytics.service.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PerformedSet {
  date: Date;
  actualWeight: number;
  actualReps: number;
  plannedWeight: number | null;
  plannedReps: number | null;
  setIndex: number;
}

export interface WeeklyVolume {
  weekStart: Date;
  totalVolume: number;
  sessionCount: number;
}

export interface TrainingFrequency {
  totalSessions: number;
  weeksSpanned: number;
  sessionsPerWeek: number;
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

export class AnalyticsService {
  async getWorkoutHistory(userId: string, weeks = 12) {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    return prisma.workoutDay.findMany({
      where: { userId, date: { gte: since } },
      include: { setRecords: { include: { exercise: true }, orderBy: { setIndex: 'asc' } } },
      orderBy: { date: 'desc' },
    });
  }

  async getRecentWorkout(userId: string) {
    return prisma.workoutDay.findFirst({
      where: { userId },
      include: { setRecords: { include: { exercise: true }, orderBy: { setIndex: 'asc' } } },
      orderBy: { date: 'desc' },
    });
  }

  async getExerciseHistory(userId: string, exerciseName: string, limit = 50): Promise<PerformedSet[]> {
    const records = await prisma.setRecord.findMany({
      where: {
        workoutDay: { userId },
        exercise: { name: exerciseName },
        actualWeight: { not: null },
        actualReps: { not: null },
      },
      include: { workoutDay: { select: { date: true } } },
      orderBy: { workoutDay: { date: 'asc' } },
      take: limit,
    });

    return records.map(record => ({
      date: record.workoutDay.date,
      actualWeight: record.actualWeight as number,
      actualReps: record.actualReps as number,
      plannedWeight: record.plannedWeight,
      plannedReps: record.plannedReps,
      setIndex: record.setIndex,
    }));
  }

  async getWeeklyVolume(userId: string, weeks = 12): Promise<WeeklyVolume[]> {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const records = await prisma.setRecord.findMany({
      where: {
        workoutDay: { userId, date: { gte: since } },
        actualWeight: { not: null },
        actualReps: { not: null },
      },
      include: { workoutDay: { select: { date: true } } },
    });

    const byWeek = new Map<string, WeeklyVolume>();
    for (const record of records) {
      const weekStart = startOfIsoWeek(record.workoutDay.date);
      const key = weekStart.toISOString();
      const existing = byWeek.get(key) ?? { weekStart, totalVolume: 0, sessionCount: 0 };
      existing.totalVolume += (record.actualWeight as number) * (record.actualReps as number);
      byWeek.set(key, existing);
    }

    return [...byWeek.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }

  async getTrainingFrequency(userId: string, weeks = 12): Promise<TrainingFrequency> {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const totalSessions = await prisma.workoutDay.count({
      where: { userId, date: { gte: since }, completed: true, isRestDay: false },
    });

    return {
      totalSessions,
      weeksSpanned: weeks,
      sessionsPerWeek: weeks > 0 ? totalSessions / weeks : 0,
    };
  }

  async getRecentPerformance(
    userId: string,
    exerciseName: string,
    sessions = 4
  ): Promise<PerformedSet[]> {
    const history = await this.getExerciseHistory(userId, exerciseName, 500);
    return history.slice(-sessions);
  }
}

export const analyticsService = new AnalyticsService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run tests/analytics.service.test.ts`
Expected: PASS (5 tests) — requires the Postgres container from Task 2 to be running.

- [ ] **Step 5: Type-check**

Run: `npx tsc -p apps/server/tsconfig.json --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/analytics.service.ts apps/server/tests/analytics.service.test.ts
git commit -m "feat(ai): add deterministic workout analytics service"
```

---

### Task 5: Deterministic progression engine and plateau detector

**Files:**
- Create: `apps/server/src/services/progression.ts`
- Create: `apps/server/src/services/plateau.ts`
- Test: `apps/server/tests/progression.test.ts`
- Test: `apps/server/tests/plateau.test.ts`

**Interfaces:**
- Consumes: `PerformedSet[]` shape from `analytics.service.ts` (Task 4) — both modules are pure functions over that array plus a `targetReps`/`muscleGroup`, no Prisma import, so they are trivially unit-testable.
- Produces: `calculateProgress(sets, targetReps, muscleGroup): ProgressionRecommendation` and `detectPlateau(sets, targetReps): PlateauResult`, consumed by `progressionTools.ts`/`plateauTools.ts` (Task 6).

- [ ] **Step 1: Write the failing progression test**

Create `apps/server/tests/progression.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateProgress } from '../src/services/progression';
import type { PerformedSet } from '../src/services/analytics.service';

function makeSet(actualWeight: number, actualReps: number, daysAgo: number): PerformedSet {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return { date, actualWeight, actualReps, plannedWeight: actualWeight, plannedReps: 8, setIndex: 1 };
}

describe('calculateProgress', () => {
  it('recommends increasing weight when the last sessions met or beat target reps', () => {
    const sets = [makeSet(60, 8, 21), makeSet(62.5, 8, 14), makeSet(62.5, 9, 7)];
    const result = calculateProgress(sets, 8, 'Chest');

    expect(result.action).toBe('increase_weight');
    expect(result.recommendedWeightKg).toBe(65);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('uses the larger lower-body increment for leg exercises', () => {
    const sets = [makeSet(80, 10, 14), makeSet(80, 10, 7)];
    const result = calculateProgress(sets, 10, 'Legs');

    expect(result.action).toBe('increase_weight');
    expect(result.recommendedWeightKg).toBe(85);
  });

  it('recommends a deload when reps have dropped sharply for two sessions', () => {
    const sets = [makeSet(70, 8, 21), makeSet(70, 5, 14), makeSet(70, 4, 7)];
    const result = calculateProgress(sets, 8, 'Chest');

    expect(result.action).toBe('deload');
    expect(result.recommendedWeightKg).toBeLessThan(70);
  });

  it('recommends maintaining load when performance is inconsistent but not failing', () => {
    const sets = [makeSet(70, 8, 21), makeSet(70, 6, 14), makeSet(70, 7, 7)];
    const result = calculateProgress(sets, 8, 'Chest');

    expect(result.action).toBe('maintain');
    expect(result.recommendedWeightKg).toBe(70);
  });

  it('returns insufficient_data with zero confidence for fewer than 2 sessions', () => {
    const result = calculateProgress([makeSet(60, 8, 1)], 8, 'Chest');
    expect(result.action).toBe('insufficient_data');
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run tests/progression.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the progression engine**

Create `apps/server/src/services/progression.ts`:

```ts
import type { PerformedSet } from './analytics.service';

const LOWER_BODY_GROUPS = new Set(['Legs']);
const UPPER_BODY_INCREMENT_KG = 2.5;
const LOWER_BODY_INCREMENT_KG = 5;
const DELOAD_FRACTION = 0.9;

export type ProgressionAction = 'increase_weight' | 'maintain' | 'deload' | 'insufficient_data';

export interface ProgressionRecommendation {
  action: ProgressionAction;
  recommendedWeightKg: number;
  targetReps: number;
  confidence: number;
  evidence: string[];
  reasoning: string;
}

function incrementFor(muscleGroup: string): number {
  return LOWER_BODY_GROUPS.has(muscleGroup) ? LOWER_BODY_INCREMENT_KG : UPPER_BODY_INCREMENT_KG;
}

export function calculateProgress(
  sets: PerformedSet[],
  targetReps: number,
  muscleGroup: string
): ProgressionRecommendation {
  if (sets.length < 2) {
    return {
      action: 'insufficient_data',
      recommendedWeightKg: sets[0]?.actualWeight ?? 0,
      targetReps,
      confidence: 0,
      evidence: [],
      reasoning: 'Fewer than 2 logged sessions for this exercise.',
    };
  }

  const lastTwo = sets.slice(-2);
  const lastWeight = sets[sets.length - 1]?.actualWeight ?? 0;
  const metOrBeatTarget = lastTwo.every(set => set.actualReps >= targetReps);
  const failedBadly = lastTwo.every(set => set.actualReps <= targetReps - 3);

  if (metOrBeatTarget) {
    return {
      action: 'increase_weight',
      recommendedWeightKg: lastWeight + incrementFor(muscleGroup),
      targetReps,
      confidence: 0.85,
      evidence: ['last_2_sessions', 'target_reps_met'],
      reasoning: `The last ${lastTwo.length} sessions met or exceeded the ${targetReps}-rep target at ${lastWeight}kg, so load can increase.`,
    };
  }

  if (failedBadly) {
    return {
      action: 'deload',
      recommendedWeightKg: Math.round((lastWeight * DELOAD_FRACTION) / 2.5) * 2.5,
      targetReps,
      confidence: 0.75,
      evidence: ['last_2_sessions', 'target_reps_missed_badly'],
      reasoning: `The last ${lastTwo.length} sessions fell 3+ reps short of the ${targetReps}-rep target, suggesting fatigue or overload.`,
    };
  }

  return {
    action: 'maintain',
    recommendedWeightKg: lastWeight,
    targetReps,
    confidence: 0.6,
    evidence: ['last_2_sessions', 'mixed_performance'],
    reasoning: `Recent performance at ${lastWeight}kg is inconsistent relative to the ${targetReps}-rep target — repeat before changing load.`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run tests/progression.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing plateau test**

Create `apps/server/tests/plateau.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectPlateau } from '../src/services/plateau';
import type { PerformedSet } from '../src/services/analytics.service';

function makeSet(actualWeight: number, actualReps: number, daysAgo: number): PerformedSet {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return { date, actualWeight, actualReps, plannedWeight: actualWeight, plannedReps: 8, setIndex: 1 };
}

describe('detectPlateau', () => {
  it('flags a plateau when weight and reps are flat across 4+ sessions', () => {
    const sets = [makeSet(70, 8, 28), makeSet(70, 8, 21), makeSet(70, 7, 14), makeSet(70, 8, 7)];
    const result = detectPlateau(sets, 8);

    expect(result.status).toBe('plateau');
    expect(result.durationSessions).toBe(4);
    expect(result.trend).toBe('flat');
  });

  it('reports progressing when weight increased across the window', () => {
    const sets = [makeSet(60, 8, 28), makeSet(62.5, 8, 21), makeSet(65, 8, 14), makeSet(67.5, 8, 7)];
    const result = detectPlateau(sets, 8);

    expect(result.status).toBe('progressing');
    expect(result.trend).toBe('upward');
  });

  it('returns insufficient_data with fewer than 4 sessions', () => {
    const sets = [makeSet(70, 8, 14), makeSet(70, 8, 7)];
    const result = detectPlateau(sets, 8);

    expect(result.status).toBe('insufficient_data');
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/server && npx vitest run tests/plateau.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Implement the plateau detector**

Create `apps/server/src/services/plateau.ts`:

```ts
import type { PerformedSet } from './analytics.service';

const PLATEAU_WINDOW = 4;
const WEIGHT_FLAT_EPSILON_KG = 0.01;

export type PlateauStatus = 'plateau' | 'progressing' | 'insufficient_data';
export type PlateauTrend = 'flat' | 'upward' | 'downward';

export interface PlateauResult {
  status: PlateauStatus;
  confidence: number;
  durationSessions: number;
  trend: PlateauTrend;
}

export function detectPlateau(sets: PerformedSet[], targetReps: number): PlateauResult {
  if (sets.length < PLATEAU_WINDOW) {
    return { status: 'insufficient_data', confidence: 0, durationSessions: sets.length, trend: 'flat' };
  }

  const window = sets.slice(-PLATEAU_WINDOW);
  const weights = window.map(set => set.actualWeight);
  const firstWeight = weights[0] as number;
  const lastWeight = weights[weights.length - 1] as number;
  const weightSpread = Math.max(...weights) - Math.min(...weights);
  const metTargetEveryTime = window.every(set => set.actualReps >= targetReps);

  if (weightSpread <= WEIGHT_FLAT_EPSILON_KG) {
    return {
      status: metTargetEveryTime ? 'progressing' : 'plateau',
      confidence: 0.8,
      durationSessions: window.length,
      trend: 'flat',
    };
  }

  const trend: PlateauTrend = lastWeight > firstWeight ? 'upward' : 'downward';

  return {
    status: trend === 'upward' ? 'progressing' : 'plateau',
    confidence: 0.7,
    durationSessions: window.length,
    trend,
  };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/server && npx vitest run tests/plateau.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Type-check**

Run: `npx tsc -p apps/server/tsconfig.json --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add apps/server/src/services/progression.ts apps/server/src/services/plateau.ts apps/server/tests/progression.test.ts apps/server/tests/plateau.test.ts
git commit -m "feat(ai): add deterministic progression and plateau detection engines"
```

---

### Task 6: Agent tools wrapping the analytics/progression/plateau services

**Files:**
- Create: `apps/server/src/ai/tools/analyticsTools.ts`
- Create: `apps/server/src/ai/tools/progressionTools.ts`
- Create: `apps/server/src/ai/tools/plateauTools.ts`
- Test: `apps/server/tests/ai/tools.test.ts`

**Interfaces:**
- Consumes: `analyticsService` (Task 4), `calculateProgress`/`detectPlateau` (Task 5), `defineTool` (Task 3).
- Produces: `analyticsTools: ToolDefinition<any, any>[]`, `progressionTools: ToolDefinition<any, any>[]`, `plateauTools: ToolDefinition<any, any>[]` — imported together as the tool list in the `ai.ts` route (Task 7).

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/ai/tools.test.ts`. This mocks `analyticsService` at the module level so the test proves the tool layer parses input/validates output correctly without needing a database:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/analytics.service', () => ({
  analyticsService: {
    getRecentPerformance: vi.fn(async (_userId: string, exerciseName: string) => [
      {
        date: new Date('2026-08-01'),
        actualWeight: 60,
        actualReps: 8,
        plannedWeight: 60,
        plannedReps: 8,
        setIndex: 1,
      },
    ]),
    getWeeklyVolume: vi.fn(async () => [{ weekStart: new Date('2026-08-01'), totalVolume: 480, sessionCount: 1 }]),
  },
}));

describe('analyticsTools', () => {
  it('getRecentPerformance tool validates input and returns the service result', async () => {
    const { analyticsTools } = await import('../../src/ai/tools/analyticsTools');
    const tool = analyticsTools.find(t => t.name === 'getRecentPerformance');
    expect(tool).toBeDefined();

    const parsed = tool!.parameters.parse({ exerciseName: 'Bench Press', sessions: 3 });
    const result = await tool!.handler('user_1', parsed);
    expect(result).toHaveLength(1);
  });

  it('getRecentPerformance tool rejects missing exerciseName', async () => {
    const { analyticsTools } = await import('../../src/ai/tools/analyticsTools');
    const tool = analyticsTools.find(t => t.name === 'getRecentPerformance');
    expect(() => tool!.parameters.parse({})).toThrow();
  });
});

describe('progressionTools', () => {
  it('calculateProgress tool combines exercise history with the progression engine', async () => {
    vi.doMock('../../src/services/analytics.service', () => ({
      analyticsService: {
        getRecentPerformance: vi.fn(async () => [
          { date: new Date(), actualWeight: 60, actualReps: 8, plannedWeight: 60, plannedReps: 8, setIndex: 1 },
          { date: new Date(), actualWeight: 62.5, actualReps: 9, plannedWeight: 62.5, plannedReps: 8, setIndex: 1 },
        ]),
      },
    }));
    const { progressionTools } = await import('../../src/ai/tools/progressionTools');
    const tool = progressionTools.find(t => t.name === 'calculateProgress');
    const parsed = tool!.parameters.parse({ exerciseName: 'Bench Press', targetReps: 8, muscleGroup: 'Chest' });
    const result = await tool!.handler('user_1', parsed);
    expect(result.action).toBe('increase_weight');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run tests/ai/tools.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement the analytics tools**

Create `apps/server/src/ai/tools/analyticsTools.ts`:

```ts
import { z } from 'zod';
import { analyticsService } from '../../services/analytics.service';
import { defineTool } from './types';

const getRecentWorkout = defineTool({
  name: 'getRecentWorkout',
  description: "Get the authenticated user's most recent workout day with all set records.",
  parameters: z.object({}),
  handler: async userId => analyticsService.getRecentWorkout(userId),
});

const getWorkoutHistory = defineTool({
  name: 'getWorkoutHistory',
  description: "Get the authenticated user's workout history over a number of past weeks.",
  parameters: z.object({ weeks: z.number().int().min(1).max(52).default(12) }),
  handler: async (userId, args) => analyticsService.getWorkoutHistory(userId, args.weeks),
});

const getExerciseHistory = defineTool({
  name: 'getExerciseHistory',
  description: 'Get every logged set for a specific exercise, oldest to newest.',
  parameters: z.object({
    exerciseName: z.string().min(1),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  handler: async (userId, args) =>
    analyticsService.getExerciseHistory(userId, args.exerciseName, args.limit),
});

const getWeeklyVolume = defineTool({
  name: 'getWeeklyVolume',
  description: 'Get total training volume (weight x reps) grouped by week.',
  parameters: z.object({ weeks: z.number().int().min(1).max(52).default(12) }),
  handler: async (userId, args) => analyticsService.getWeeklyVolume(userId, args.weeks),
});

const getTrainingFrequency = defineTool({
  name: 'getTrainingFrequency',
  description: 'Get how many completed training sessions per week over a window.',
  parameters: z.object({ weeks: z.number().int().min(1).max(52).default(12) }),
  handler: async (userId, args) => analyticsService.getTrainingFrequency(userId, args.weeks),
});

const getRecentPerformance = defineTool({
  name: 'getRecentPerformance',
  description: 'Get the last N sessions of a specific exercise for trend analysis.',
  parameters: z.object({
    exerciseName: z.string().min(1),
    sessions: z.number().int().min(1).max(20).default(4),
  }),
  handler: async (userId, args) =>
    analyticsService.getRecentPerformance(userId, args.exerciseName, args.sessions),
});

export const analyticsTools = [
  getRecentWorkout,
  getWorkoutHistory,
  getExerciseHistory,
  getWeeklyVolume,
  getTrainingFrequency,
  getRecentPerformance,
];
```

- [ ] **Step 4: Implement the progression tool**

Create `apps/server/src/ai/tools/progressionTools.ts`:

```ts
import { z } from 'zod';
import { analyticsService } from '../../services/analytics.service';
import { calculateProgress } from '../../services/progression';
import { defineTool } from './types';

const calculateProgressTool = defineTool({
  name: 'calculateProgress',
  description:
    'Compute a deterministic progressive-overload recommendation for one exercise from recent performance.',
  parameters: z.object({
    exerciseName: z.string().min(1),
    targetReps: z.number().int().min(1).max(30),
    muscleGroup: z.string().min(1),
  }),
  handler: async (userId, args) => {
    const recentSets = await analyticsService.getRecentPerformance(userId, args.exerciseName, 4);
    return calculateProgress(recentSets, args.targetReps, args.muscleGroup);
  },
});

export const progressionTools = [calculateProgressTool];
```

- [ ] **Step 5: Implement the plateau tool**

Create `apps/server/src/ai/tools/plateauTools.ts`:

```ts
import { z } from 'zod';
import { analyticsService } from '../../services/analytics.service';
import { detectPlateau } from '../../services/plateau';
import { defineTool } from './types';

const detectPlateauTool = defineTool({
  name: 'detectPlateau',
  description: 'Deterministically check whether an exercise has plateaued over its recent sessions.',
  parameters: z.object({
    exerciseName: z.string().min(1),
    targetReps: z.number().int().min(1).max(30),
  }),
  handler: async (userId, args) => {
    const recentSets = await analyticsService.getRecentPerformance(userId, args.exerciseName, 6);
    return detectPlateau(recentSets, args.targetReps);
  },
});

export const plateauTools = [detectPlateauTool];
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/server && npx vitest run tests/ai/tools.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Type-check**

Run: `npx tsc -p apps/server/tsconfig.json --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/ai/tools/analyticsTools.ts apps/server/src/ai/tools/progressionTools.ts apps/server/src/ai/tools/plateauTools.ts apps/server/tests/ai/tools.test.ts
git commit -m "feat(ai): wrap analytics/progression/plateau services as agent tools"
```

---

### Task 7: Structured workout-analysis output schema + `/api/v1/ai` route

**Files:**
- Create: `apps/server/src/ai/schemas/workoutAnalysis.ts`
- Create: `apps/server/src/routes/ai.ts`
- Modify: `apps/server/src/index.ts` (mount the new router)
- Test: `apps/server/tests/ai.routes.test.ts`

**Interfaces:**
- Consumes: `runAgent` (Task 3), `getOpenAIClient`/`AiNotConfiguredError` (Task 1), `analyticsTools`/`progressionTools`/`plateauTools` (Task 6), `agentRunLogger` (Task 3), `analyticsService` (Task 4, for the fitness-state endpoint), `authenticate`/`AuthRequest` (existing).
- Produces: `router` default export mounted at `/api/v1/ai`, matching how `authRoutes`/`workoutRoutes`/etc. are mounted in `index.ts`.

- [ ] **Step 1: Define the structured output schema**

Create `apps/server/src/ai/schemas/workoutAnalysis.ts` (mirrors the exact shape given in the brief's section 7 example, plus one array wrapper since a full workout has multiple exercises):

```ts
import { z } from 'zod';

export const progressionRecommendationSchema = z.object({
  type: z.literal('progression_recommendation'),
  exercise: z.string(),
  action: z.enum(['increase_weight', 'maintain', 'deload', 'insufficient_data']),
  recommendedWeightKg: z.number(),
  targetSets: z.number().int(),
  targetReps: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  reasoning: z.string(),
});

export const workoutAnalysisSchema = z.object({
  summary: z.string(),
  recommendations: z.array(progressionRecommendationSchema),
  plateauedExercises: z.array(z.string()),
  overallTrend: z.enum(['improving', 'steady', 'declining', 'insufficient_data']),
});

export type WorkoutAnalysis = z.infer<typeof workoutAnalysisSchema>;
```

- [ ] **Step 2: Write the failing route test**

Create `apps/server/tests/ai.routes.test.ts`. It mocks `runAgent` entirely (no OpenAI call, no key needed), and mocks the analytics service for the fitness-state endpoint, then drives the route through Supertest exactly like `tests/auth.test.ts` does:

```ts
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/ai/agentRunner', () => ({
  runAgent: vi.fn(async () => ({
    output: {
      summary: 'Bench press is progressing well.',
      recommendations: [
        {
          type: 'progression_recommendation',
          exercise: 'Bench Press',
          action: 'increase_weight',
          recommendedWeightKg: 65,
          targetSets: 3,
          targetReps: '6-8',
          confidence: 0.87,
          evidence: ['last_4_sessions'],
          reasoning: 'Consistent overload.',
        },
      ],
      plateauedExercises: [],
      overallTrend: 'improving',
    },
    toolCalls: [{ name: 'getRecentPerformance', args: { exerciseName: 'Bench Press' } }],
    usage: { promptTokens: 100, completionTokens: 50 },
  })),
  AgentOutputError: class AgentOutputError extends Error {},
}));

vi.mock('../src/ai/agentRunLogger', () => ({
  agentRunLogger: { log: vi.fn(async () => undefined) },
}));

vi.mock('../src/ai/openaiClient', () => ({
  getOpenAIClient: vi.fn(() => ({})),
  AiNotConfiguredError: class AiNotConfiguredError extends Error {},
}));

vi.mock('../src/services/analytics.service', () => ({
  analyticsService: {
    getTrainingFrequency: vi.fn(async () => ({ totalSessions: 4, weeksSpanned: 4, sessionsPerWeek: 1 })),
    getWeeklyVolume: vi.fn(async () => [{ weekStart: new Date(), totalVolume: 1000, sessionCount: 1 }]),
  },
}));

const prisma = new PrismaClient();

describe('AI routes', () => {
  let accessToken: string;

  beforeEach(async () => {
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.user.deleteMany({});

    const { default: app } = await import('../src/index');
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      name: 'AI Test User',
      email: `ai-test-${Date.now()}@example.com`,
      password: 'testpassword123',
    });
    accessToken = registerResponse.body.data.tokens.accessToken;
  });

  afterEach(async () => {
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('rejects analyze-workout without authentication', async () => {
    const { default: app } = await import('../src/index');
    await request(app).post('/api/v1/ai/analyze-workout').expect(401);
  });

  it('returns a schema-valid workout analysis for an authenticated user', async () => {
    const { default: app } = await import('../src/index');
    const response = await request(app)
      .post('/api/v1/ai/analyze-workout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.analysis.overallTrend).toBe('improving');
    expect(response.body.data.analysis.recommendations[0].exercise).toBe('Bench Press');
  });

  it('returns a live-computed fitness state summary', async () => {
    const { default: app } = await import('../src/index');
    const response = await request(app)
      .get('/api/v1/ai/fitness-state')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.trainingFrequency.totalSessions).toBe(4);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/server && npx vitest run tests/ai.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/routes/ai'` (via index.ts import failure) or 404 on the new routes

- [ ] **Step 4: Implement the route**

Create `apps/server/src/routes/ai.ts`:

```ts
import { Response, Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { AgentOutputError, runAgent } from '../ai/agentRunner';
import { agentRunLogger } from '../ai/agentRunLogger';
import { AiNotConfiguredError, getOpenAIClient } from '../ai/openaiClient';
import { analyticsTools } from '../ai/tools/analyticsTools';
import { progressionTools } from '../ai/tools/progressionTools';
import { plateauTools } from '../ai/tools/plateauTools';
import { workoutAnalysisSchema } from '../ai/schemas/workoutAnalysis';
import { analyticsService } from '../services/analytics.service';

const router = Router();
router.use(authenticate);

const coachTools = [...analyticsTools, ...progressionTools, ...plateauTools];

const SYSTEM_PROMPT = `You are IronLog's training coach. You analyze a user's real workout data using the
provided tools, then respond with ONLY a JSON object matching this shape:
{
  "summary": string,
  "recommendations": [{ "type": "progression_recommendation", "exercise": string,
    "action": "increase_weight" | "maintain" | "deload" | "insufficient_data",
    "recommendedWeightKg": number, "targetSets": number, "targetReps": string,
    "confidence": number, "evidence": string[], "reasoning": string }],
  "plateauedExercises": string[],
  "overallTrend": "improving" | "steady" | "declining" | "insufficient_data"
}
Never invent numbers you did not get from a tool call. If there is not enough data, say so and use
"insufficient_data". You are not a doctor: if the user mentions pain, injury, or medical symptoms,
tell them to consult a qualified professional instead of diagnosing anything.`;

router.post('/analyze-workout', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const startedAt = new Date();

  try {
    const client = getOpenAIClient();
    const { output, toolCalls, usage } = await runAgent({
      client,
      userId,
      model: config.openaiModel,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'Analyze my recent training and tell me what to do next.',
      tools: coachTools,
      outputSchema: workoutAnalysisSchema,
    });

    await agentRunLogger.log({
      userId,
      workflow: 'analyze_workout',
      model: config.openaiModel,
      status: 'success',
      toolCalls,
      tokensPrompt: usage.promptTokens,
      tokensCompletion: usage.completionTokens,
      startedAt,
      finishedAt: new Date(),
    });

    return res.json({ success: true, data: { analysis: output } });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return res.status(503).json({ success: false, error: { message: error.message } });
    }

    await agentRunLogger.log({
      userId,
      workflow: 'analyze_workout',
      model: config.openaiModel,
      status: error instanceof AgentOutputError ? 'validation_failed' : 'error',
      toolCalls: [],
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      startedAt,
      finishedAt: new Date(),
    });

    console.error('AI workout analysis error:', error);
    return res.status(502).json({
      success: false,
      error: { message: 'AI analysis is temporarily unavailable' },
    });
  }
});

router.get('/fitness-state', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const [trainingFrequency, weeklyVolume] = await Promise.all([
      analyticsService.getTrainingFrequency(userId, 8),
      analyticsService.getWeeklyVolume(userId, 8),
    ]);

    return res.json({ success: true, data: { trainingFrequency, weeklyVolume } });
  } catch (error) {
    console.error('Fitness state error:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

export default router;
```

- [ ] **Step 5: Mount the router**

Edit `apps/server/src/index.ts` — add the import next to the other route imports and the mount next to the other `app.use('/api/v1/...')` lines:

```ts
import aiRoutes from './routes/ai';
```

```ts
app.use('/api/v1/ai', aiRoutes);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/server && npx vitest run tests/ai.routes.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Run the full new AI test suite together**

Run: `cd apps/server && npx vitest run tests/ai tests/analytics.service.test.ts tests/progression.test.ts tests/plateau.test.ts tests/ai.routes.test.ts`
Expected: all PASS

- [ ] **Step 8: Type-check**

Run: `npx tsc -p apps/server/tsconfig.json --noEmit`
Expected: no errors

- [ ] **Step 9: Manually verify the existing (non-AI) suite still runs unmodified**

Run: `cd apps/server && npx vitest run tests/auth.test.ts`
Expected: same pass/fail outcome as before this plan started — this plan must not change that file's behavior. (If it was already failing before Task 1, per the audit's note on the currently-stubbed `test` script, it should fail in exactly the same way now, not differently.)

- [ ] **Step 10: Commit**

```bash
git add apps/server/src/ai/schemas/workoutAnalysis.ts apps/server/src/routes/ai.ts apps/server/src/index.ts apps/server/tests/ai.routes.test.ts
git commit -m "feat(ai): add POST /api/v1/ai/analyze-workout and GET /api/v1/ai/fitness-state"
```

---

## Self-Review Notes (recorded for the executor)

- **Coverage:** Task 1-3 = Phase 1 (foundations: client, config, schema, tool contract, runner, logger). Task 4-6 = Phase 2 (analytics/progression/plateau as deterministic services + tools). Task 7 = Phase 3 (first structured, agent-backed endpoint + a live-computed fitness-state read). RAG (Phase 4), the full Coach Agent with memory (Phase 5-6), mutation tools (Phase 7+), and frontend UI (Phase 12) are intentionally out of scope for this plan and will be separate plans.
- **Known residual risk:** `agentRunner.ts`'s tool-call loop is written against the stable `chat.completions.create` API rather than the `openai` SDK's newer `runTools`/`zodFunction` beta helpers, specifically so it can be fully tested now with a fake client and re-verified cheaply once a real `OPENAI_API_KEY` is available — but the very first live call against the real API should be spot-checked manually (`curl` the route with a real key) before this is considered production-ready, since no test in this plan touches the real network.
- **`WorkoutDay.date` global-uniqueness bug** (found during the audit, not part of this plan): left untouched. It only breaks multi-user concurrent same-day workouts; flagged separately, not fixed here since it's a pre-existing issue outside this plan's scope.
