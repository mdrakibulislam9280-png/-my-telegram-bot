# Project Overview

A pnpm monorepo containing a Telegram bot + Express API server backed by PostgreSQL, with shared TypeScript libraries.

## Stack

- **Runtime**: Node.js (ESM)
- **API server**: Express 5, TypeScript, esbuild (bundled for dev & prod)
- **Database**: PostgreSQL via Drizzle ORM
- **Bot**: Telegram (`node-telegram-bot-api`) — optional, enabled when `TELEGRAM_BOT_TOKEN` is set
- **Package manager**: pnpm (workspaces)

## Project structure

```
artifacts/
  api-server/       Express API + Telegram bot
  mockup-sandbox/   Vite/React component preview sandbox
lib/
  db/               Drizzle ORM schema & client
  api-zod/          Zod validation schemas shared across server/client
  api-client-react/ React Query hooks generated from OpenAPI spec
  api-spec/         OpenAPI spec + Orval codegen config
scripts/            Utility scripts
```

## Running locally (Replit)

Both services start automatically via configured workflows:

| Service | Workflow name | Preview path |
|---------|--------------|--------------|
| API server | `artifacts/api-server: API Server` | `/api` |
| Mockup sandbox | `artifacts/mockup-sandbox: Component Preview Server` | `/__mockup` |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ Yes | Express session secret |
| `TELEGRAM_BOT_TOKEN` | ⚠️ Optional | Telegram bot token — bot is skipped if not set |
| `PORT` | Auto-set | Assigned by Replit per artifact |

## API endpoints

- `GET /api/healthz` — health check, returns `{"status":"ok"}`

## User preferences

<!-- Add user preferences here -->
