# IronLog

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

IronLog is a full-stack workout tracker that has grown an AI training coach on top of its
existing data. It's not a chatbot bolted onto a fitness app — the agent reasons over your
actual logged sets, calls deterministic analysis tools, and retrieves training knowledge to
back up what it recommends, instead of guessing.

## What IronLog does

**Core tracking** (the original app):

- Log workouts against pre-defined splits (Chest+Triceps, Back+Biceps, Legs+Shoulders) or a
  custom exercise list, set by set, with planned vs. actual weight/reps and rest timers
- Full workout history, exercise library by muscle group, and a progress dashboard with
  volume, one-rep-max estimates, and per-exercise trend charts
- JWT authentication (short-lived access token + httpOnly refresh cookie), mobile-first UI,
  installable as a PWA

**AI training coach** (built on top, in `apps/server/src/ai`):

- **Workout analysis** — `POST /api/v1/ai/analyze-workout` runs a tool-calling agent that
  pulls your real recent performance, computes progression/plateau signals deterministically,
  and returns a structured, schema-validated recommendation — never free-form prose the app
  has to parse to act on
- **Deterministic analytics engines** — training volume, frequency, per-exercise progress,
  progressive-overload recommendations, and plateau detection are all plain TypeScript
  functions with their own unit tests, not LLM guesses. The model chooses *when* to use them
  and how to explain the result; it never invents the numbers itself
- **RAG knowledge retrieval** — a small curated library of training-principle documents
  (progressive overload, recovery, volume/frequency, plateaus, safety) is chunked, embedded,
  and stored in Postgres via `pgvector`. The agent's `searchFitnessKnowledge` tool does
  semantic retrieval over it and cites the source document for anything it pulls in
- **Live fitness snapshot** — `GET /api/v1/ai/fitness-state` and the knowledge-search
  endpoint expose the same building blocks directly, so recommendations and their
  supporting evidence are inspectable, not a black box
- **Observability by default** — every agent run is logged (`AgentRun`) with the tools it
  called, token usage, and outcome, so failures and cost are traceable

See [`docs/superpowers/plans/2026-08-25-ai-coach-foundations.md`](docs/superpowers/plans/2026-08-25-ai-coach-foundations.md)
for the implementation plan and the architectural reasoning behind these choices (why OpenAI,
why pgvector instead of a separate vector database, why the agent loop is hand-rolled instead
of a heavier framework).

## Architecture

```
User request
     │
     ▼
Express route (/api/v1/ai/*)          — auth-checked, userId from JWT only
     │
     ▼
Agent runner (tool-call loop)         — src/ai/agentRunner.ts
     │
     ├──▶ Analytics tools ────────────▶ Postgres (workout history, via Prisma)
     ├──▶ Progression/plateau tools ──▶ deterministic TS engines, no LLM involved
     └──▶ Knowledge tool ─────────────▶ OpenAI embeddings ──▶ pgvector similarity search
     │
     ▼
Zod-validated structured output       — never raw LLM text reaches the response or the DB
     │
     ▼
JSON response + AgentRun log
```

The model proposes; it never mutates the database directly. Every tool call is Zod-validated
on the way in and out, and every tool receives the authenticated `userId` from the request —
never from the LLM's own output — so one user's agent run can't reach another user's data.

## Tech Stack

### Frontend

- **Next.js 15** (App Router, React 19, TypeScript)
- **MUI v6** + Tailwind CSS
- **Zustand** for state management, **Recharts** for progress visualizations
- **Framer Motion** for animations

### Backend

- **Node.js** + **Express 5**
- **TypeScript** + **Prisma ORM** + **PostgreSQL** (with the `pgvector` extension for AI
  knowledge retrieval)
- **JWT authentication** (access token + httpOnly refresh cookie)
- **OpenAI API** — `gpt-4o-mini` for agent reasoning and tool calling,
  `text-embedding-3-small` for RAG embeddings

### Testing & Quality

- **Vitest** + **Supertest** for unit/API tests (including the AI agent runner, tools, and
  RAG pipeline — all mocked against a fake OpenAI client, no API key required in CI)
- **Playwright** for E2E testing
- **ESLint** + **Prettier** + **Husky** pre-commit hooks (lint, type-check, test)

### DevOps

- **Docker** + **Docker Compose** (Postgres image includes `pgvector`)
- **Turbo** monorepo tooling, **pnpm** workspaces

## Project Structure

```
ironlog/
├── apps/
│   ├── web/                    # Next.js frontend
│   └── server/                 # Express API
│       ├── prisma/             # Schema + migrations (workouts, users, and AI models)
│       └── src/
│           ├── routes/         # auth, workouts, exercises, set-records, ai
│           ├── services/       # workout, analytics, progression, plateau (deterministic)
│           └── ai/
│               ├── agentRunner.ts     # tool-call loop, Zod-validated output
│               ├── agentRunLogger.ts  # observability (AgentRun table)
│               ├── openaiClient.ts    # lazy OpenAI client, fails clearly with no key
│               ├── tools/             # analytics/progression/plateau/knowledge tools
│               ├── rag/               # chunking, embeddings, pgvector retrieval
│               ├── knowledge/         # curated training-principle source documents
│               └── schemas/           # Zod schemas for structured agent output
├── packages/
│   └── ui/                     # Shared UI components
├── docs/
│   └── superpowers/plans/      # Implementation plans and architectural decisions
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Node.js 18+, pnpm 8+, Docker & Docker Compose
- An OpenAI API key (only required for the AI endpoints — the rest of the app works without one)

### Setup

```bash
pnpm install
cp apps/server/.env.example apps/server/.env   # add your OPENAI_API_KEY here
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

### AI-specific setup

The AI endpoints degrade gracefully without a key (`503 OPENAI_API_KEY is not configured`)
so the rest of the app is unaffected. To enable them:

1. Set `OPENAI_API_KEY` in `apps/server/.env`
2. Ingest the curated knowledge base into `pgvector` (one-time, re-run after editing
   `apps/server/src/ai/knowledge/*.md`):
   ```bash
   pnpm --filter @ironlog/server run ai:ingest-knowledge
   ```

## Environment Variables

### Backend (`apps/server/.env`)

```bash
DATABASE_URL="postgresql://ironlog:password@localhost:5432/ironlog"
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
NODE_ENV="development"
PORT=3001

# AI (optional — omit to run IronLog without AI features)
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

### Frontend (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
```

## API Overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/auth/*` | — | Register, login, refresh, logout |
| `/api/v1/workouts/*` | — | Start/complete workouts, history, stats |
| `/api/v1/exercises/*` | — | Exercise library, CRUD |
| `/api/v1/set-records` | — | Log/update individual sets |
| `/api/v1/ai/analyze-workout` | POST | Agent-generated, schema-validated workout analysis |
| `/api/v1/ai/fitness-state` | GET | Live-computed training frequency + volume snapshot |
| `/api/v1/ai/knowledge-search` | GET | Semantic search over the curated knowledge base (`?q=`) |

All routes except `/auth/register` and `/auth/login` require a `Bearer` access token; every
handler resolves `userId` from the verified JWT, never from the request body.

## Available Scripts

```bash
pnpm dev                          # Start all development servers
pnpm build                        # Build all applications
pnpm test                         # Run all tests
pnpm test:e2e                     # Run E2E tests
pnpm lint                         # Lint all packages
pnpm type-check                   # TypeScript type checking

pnpm db:migrate                   # Run database migrations
pnpm db:seed                      # Seed database with initial data
pnpm --filter @ironlog/server run ai:ingest-knowledge  # (Re)embed the AI knowledge base
```

## Testing

- **Unit/API tests**: `pnpm test` — includes the agent runner, every AI tool, the RAG
  chunker/embeddings/retrieval pipeline (against a real local `pgvector` instance), and the
  `/api/v1/ai/*` routes, all with the OpenAI client mocked so no API key or network call is
  needed in CI
- **E2E tests**: `pnpm test:e2e` with Playwright

## Deployment

**Backend (Render):** create a Web Service, root directory `apps/server`, build command
`npm install && npx prisma generate && npx prisma migrate deploy && npm run build`, start
command `npm start`, health check path `/health`. Set `DATABASE_URL`, `JWT_SECRET`,
`JWT_REFRESH_SECRET`, `NODE_ENV=production`, and (for AI features) `OPENAI_API_KEY`.

> pnpm workspace gotcha: Render's default npm install chokes on `workspace:*` references from
> the repo root (`EUNSUPPORTEDPROTOCOL`). Setting **Root Directory** to `apps/server` avoids
> this — `apps/server/package.json` only has ordinary npm dependencies.

**Frontend (Vercel):** deploy `apps/web` directly; set `NEXT_PUBLIC_API_URL` to your deployed
backend's `/api/v1` URL in the Vercel project's environment variables.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
