import { Prisma, PrismaClient } from '@prisma/client';

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
        toolCalls: entry.toolCalls as unknown as Prisma.InputJsonValue,
        tokensPrompt: entry.tokensPrompt ?? null,
        tokensCompletion: entry.tokensCompletion ?? null,
        errorMessage: entry.errorMessage ?? null,
        startedAt: entry.startedAt,
        finishedAt: entry.finishedAt,
      },
    });
  },
};
