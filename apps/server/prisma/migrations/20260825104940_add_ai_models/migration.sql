-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "CoachMemoryType" AS ENUM ('GOAL', 'PREFERENCE', 'CONSTRAINT', 'FACT');

-- CreateTable
CREATE TABLE "fitness_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goals" JSONB,
    "trainingExperience" TEXT,
    "currentProgram" TEXT,
    "weeklyVolume" JSONB,
    "trainingFrequency" DOUBLE PRECISION,
    "consistencyScore" DOUBLE PRECISION,
    "progressingExercises" TEXT[],
    "stalledExercises" TEXT[],
    "recentPerformanceTrend" TEXT,
    "recoverySignals" JSONB,
    "preferredExercises" TEXT[],
    "dislikedExercises" TEXT[],
    "preferredSessionDuration" INTEGER,
    "equipment" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fitness_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CoachMemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "coach_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "toolCalls" JSONB NOT NULL,
    "tokensPrompt" INTEGER,
    "tokensCompletion" INTEGER,
    "errorMessage" TEXT,
    "userAccepted" BOOLEAN,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fitness_states_userId_key" ON "fitness_states"("userId");

-- CreateIndex
CREATE INDEX "coach_memories_userId_type_idx" ON "coach_memories"("userId", "type");

-- CreateIndex
CREATE INDEX "agent_runs_userId_workflow_idx" ON "agent_runs"("userId", "workflow");

-- AddForeignKey
ALTER TABLE "fitness_states" ADD CONSTRAINT "fitness_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_memories" ADD CONSTRAINT "coach_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
