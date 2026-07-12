# Training Tracker

A single-user personal training log and progress app, built with Next.js, Prisma, and Vercel.

## Features

1. **Training log**: seeded exercise library, create/select exercises, log workouts with sets, edit/delete entries.
2. **Statistics**: per-exercise weight/reps/est 1RM and volume charts; per-muscle-group weekly volume; weekly session consistency.
3. **Coach**: two-stage deterministic rules engine + LLM phrasing via Gemini, on-demand Coach's Note.

## Database

I chose **Vercel Postgres** (Neon) because it is the Vercel-native Postgres offering and is the quickest to provision for a single-user, low-volume app. It is serverless, no separate account to manage, and integrates directly with Vercel environment variables.

## Environment variables

Copy `.env.example` to `.env` locally and set all values for Vercel:

- `DATABASE_URL` — Vercel Postgres pooled connection (`POSTGRES_PRISMA_URL` if using Vercel's preset).
- `DIRECT_URL` — Vercel Postgres direct connection (`POSTGRES_URL` or `DATABASE_URL_UNPOOLED` if using Vercel's preset).
- `APP_PASSPHRASE` — single shared passphrase that gates the app.
- `GEMINI_API_KEY` — Google AI Studio API key for Coach phrasing.

## Local development

```bash
npm install
# Ensure a Postgres database is running and DATABASE_URL/DIRECT_URL are set.
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `APP_PASSPHRASE`.

## Tests

```bash
npm run test
```

## Lint

```bash
npm run lint
```

## Deploy to Vercel

```bash
vercel --prod
```

The build command runs `prisma generate`, `prisma migrate deploy`, `prisma db seed`, and `next build`. Migrations are applied automatically and seed runs idempotently on each deploy.

## How to provision Vercel Postgres

1. In the Vercel dashboard for the project, go to **Storage** and create a new **Postgres** database (Neon) via the Vercel Marketplace.
2. Connect the database to the project. This will add `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, etc. as environment variables.
3. Set `DATABASE_URL` to `POSTGRES_PRISMA_URL` and `DIRECT_URL` to `POSTGRES_URL`.
4. Set `APP_PASSPHRASE` and `GEMINI_API_KEY`.

After provisioning, deploy as usual. The first deploy will run migrations and seed the starter exercise library.

## Training philosophy

A placeholder for the grounding document is at `docs/training-philosophy.md`. The Coach's system prompt reads this file at request time and falls back to the stored config when the placeholder is still present.

## Notes

- Single user only, no signup. Auth is a simple passphrase cookie session.
- Stage A rules are pure, deterministic, and fully unit-tested. Stage B is a mockable LLM phrasing pass.
