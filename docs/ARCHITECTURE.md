# Training Tracker — Architecture & Agent Guide

> This document is the single source of truth for the codebase. Read it first when you pick up this project.

## 1. What the app does

A single-user personal training log with a built-in analytics layer.

### Core functional requirements

- Log workouts by date and notes.
- Add/edit/delete sets per workout (exercise, reps, weight, unit, optional RIR/RPE, optional notes).
- Exercise library with seeded system exercises; user can add new ones.
- Dashboard: recent workouts, quick counts, signals, Progress Verdict.
- Stats page: per-exercise trends (weight, reps, e1RM, volume), per-muscle weekly hard sets, session consistency.
- Coach: on-demand natural-language note based on deterministic signals + training philosophy.
- Judge: stats-only Progress Verdict (`progressing` / `stagnating` / `declining` / `insufficient-data`).
- Settings: user-configurable analysis windows and frequency targets.
- Auth: single shared passphrase; no multi-user support, no signup.

### Non-functional requirements

- Single user only. No accounts, social features, wearable integrations, or food tracking.
- Deployed on Vercel; database is Vercel Postgres (Neon) on the free/hobby tier.
- No cost to the user at current usage.
- Deterministic analysis must be testable and unit-tested (`vitest`).
- Minimal, mobile-friendly UI; server-rendered where possible.
- `next/headers` `cookies()` returns a `Promise` in this Next.js version — always `await` it.

---

## 2. First-principles design

The app separates three concerns:

| Layer | Purpose | Inputs | Output |
|---|---|---|---|
| **Data** (`SetEntry`, `Workout`, `Exercise`, `Config`) | Ground truth | User logs sets | Raw training history |
| **Judge** (`lib/judge.ts`) | Brutal-truth stats verdict | Same raw history; *no* philosophy | `ProgressVerdict` + observations |
| **Coach** (`lib/coach`) | Doctrine-aligned guidance | Raw history + `Config` + `docs/training-philosophy.md` | Natural-language note |

### Why this split?

- The **Judge** is the “no-bullshit” layer. It tells you what the numbers say, period. It has no access to the training doctrine.
- The **Coach** is the “so what?” layer. It receives the same numbers plus the philosophy/config and turns the verdict into actionable, doctrine-aligned advice.
- The **Stats page** surfaces both: charts + metrics + Judge analysis + Coach interpretation.

### Key values

- **Ground truth is the log.** Any manual edit in the DB must be reflected immediately in judge/coach/stats.
- **Weekly grouping is anchored to the latest workout**, not the calendar week. This keeps cold-start and recent history coherent when the user logs irregularly.
- **Cold start is not failure.** With fewer than 4 sessions or less than 14 days of history the verdict is `insufficient-data` and noisy metrics (e1RM, volume-load, muscle-volume) are suppressed.
- **Minimum-effective dose is the default assumption.** Settings default to 2 hard sets per exercise and 2–3 full-body sessions per week. The coach should not push higher volume unless the data clearly supports it.

---

## 3. Information flow

```
User logs sets
       │
       ▼
  SetEntry (DB)
       │
       ├──► Stats charts      ──► UI: per-exercise / muscle / consistency charts
       │
       ├──► Judge (lib/judge) ──► Progress Verdict + observations
       │                              (stats-only, no philosophy)
       │
       └──► Coach Stage A (lib/coach/rules)
              │
              ├──► Dashboard signals (warnings / no-signal)
              │
              └──► Coach Stage B (lib/coach/index.ts)
                     │
                     ├──► reads docs/training-philosophy.md
                     ├──► uses Config for context
                     └──► calls Gemini (3.5-flash primary, 3.1-flash-lite fallback)
                            │
                            └──► UI: Coach's Note
```

### Inputs shared by Judge and Coach

- `SetEntry` rows for the last 12 weeks
- `Exercise` names and `muscleGroups`
- `Config` (frequency, target sets per exercise, analysis windows)
- Derived `date`, `reps`, `weight`, `unit`, `rir`, `rpe`, `createdAt`

### What is *not* shared

- The **Judge** does **not** read `docs/training-philosophy.md`.
- The **Coach** does read it and also gets the raw `Signal[]` list from Stage A.

---

## 4. Technical stack

- **Framework**: Next.js 16.2.10, App Router, React 19.2.4, TypeScript 5.
- **Database**: Prisma 6.19.3 + Vercel Postgres (Neon PostgreSQL).
- **Auth**: `jose` JWT session in an `httpOnly` cookie (`lib/auth.ts`).
- **Charts**: Recharts.
- **LLM**: Google Gemini via `lib/coach/llm.ts` (primary `gemini-3.5-flash`, fallback `gemini-3.1-flash-lite`, 15 s timeout).
- **Testing**: Vitest.
- **Lint**: ESLint (`eslint-config-next`).

### Important environment variables

- `DATABASE_URL` — pooled Neon connection for queries.
- `DIRECT_URL` — direct Neon connection for `prisma migrate deploy` (advisory locks).
- `APP_PASSPHRASE` — single shared login phrase.
- `GEMINI_API_KEY` — Google AI Studio key for the coach / explain / judge-me features.

### Deployment notes

- `npm run build` runs `prisma generate`, `prisma migrate deploy`, `prisma db seed`, and `next build`.
- `prisma db seed` is idempotent (`upsert` for exercises and config).
- `prisma.config.ts` is used for migrations; it must **not** import `dotenv/config`.
- Migrations require `DIRECT_URL` because `pg_advisory_lock` does not work over pooled connections.

---

## 5. Domain model

```prisma
Exercise      name (unique), muscleGroups[], movementPattern?, isSystem?
Workout       date, notes?
SetEntry      workout, exercise, reps, weight, unit, rir?, rpe?, notes?
Config        id='default', splitType, frequencyMin/Max, primaryGoal,
              targetSetsPerExercise, stagnationWindowWeeks, volumeBaselineWeeks,
              volumeDropThreshold, consistencyWindowWeeks
```

### What you need to log per set to get all metrics

| Metric | Required fields |
|---|---|
| e1RM trend | `weight` + `reps` |
| Volume-load trend | `weight` + `reps` |
| Weekly muscle hard sets | `Exercise` (muscle groups) + set count |
| Session adherence | `Workout.date` |
| RPE/RIR drift | `rir` or `rpe` + same weight/reps across sessions |
| Set-to-set rep drop-off | `weight` + `reps` for both sets in the same workout |

So: **exercise + weight + reps + unit** unlocks 5 of 6 metrics. Add `RIR` for the sixth.

---

## 6. The analysis layers in detail

### Judge (`lib/judge.ts`)

Pure, deterministic, stats-only.

- **e1RM**: Epley formula `weight * (1 + reps / 30)`.
- **Volume load**: `reps * weight` per session per exercise.
- **Muscle volume**: weekly hard sets per muscle group, anchored to the latest workout week.
- **Adherence**: sessions in the configured consistency window, scaled by elapsed time from the first session.
- **RPE/RIR drift**: compares sets with the same exercise, weight, and reps across consecutive sessions.
- **Set drop-off**: rep difference between the first and second set of the same exercise in the same workout.

Returns a `ProgressVerdict` with `status`, `headline`, and `observations[]`.

Cold start (`< 4 sessions` or `< 14 days`): status forced to `insufficient-data` and headline explains that more data is needed.

### Coach Stage A (`lib/coach/rules.ts`)

Deterministic rule engine producing `Signal[]`:

- Positive trend in estimated 1RM.
- Positive trend in volume load.
- RPE/RIR drift down (improved effort quality).
- Volume drop below baseline.
- Consistency drop (missed sessions relative to frequency target).

Rules use the **same latest-workout-week anchor and proportional adherence target** as the judge.

### Coach Stage B (`lib/coach/index.ts`)

- Reads `docs/training-philosophy.md`.
- Builds a system prompt from base coaching instructions + philosophy/config.
- Sends the `Signal[]` list to Gemini.
- Falls back to deterministic `fallbackNote()` on LLM failure.

### Signal explain (`lib/coach/explain.ts`)

Takes a single `Signal` and asks the coach LLM to explain it in context.

---

## 7. Directory layout

```
app/                  Next.js App Router
  (app)/              Authenticated routes (layout checks session)
    page.tsx          Dashboard
    stats/page.tsx    Stats + Progress Verdict + Judge/Coach buttons
    settings/page.tsx Config editor
    workouts/         List / new / detail
    exercises/        List / create
  actions.ts          All server actions (auth, CRUD, coach, judge, stats)
  api/                Debug/test routes (not user-facing)
  globals.css         Global styles + .blink animation
  layout.tsx          Root layout
  login/page.tsx      Login form

components/           React components
  workout-form.tsx    Group-by-exercise set editor
  stats-charts.tsx    Recharts charts
  progress-verdict.tsx
  signal-alerts.tsx
  coach-note.tsx
  settings-form.tsx
  ...

lib/                  Business logic
  auth.ts             jose cookie session
  db.ts               Prisma singleton
  dates.ts            UTC week helpers (Monday start)
  est1rm.ts           Epley formula
  judge.ts            Independent stats verdict
  coach/              Coach system
    index.ts          Stage B orchestration
    rules.ts          Stage A deterministic rules
    llm.ts            Gemini client
    explain.ts        Signal explanation

docs/
  training-philosophy.md   Grounding document for the coach
  ARCHITECTURE.md          This file

prisma/
  schema.prisma
  seed.mjs
  migrations/
```

---

## 8. Conventions & gotchas for the next agent

- **Always `await cookies()`** in server actions/components. It is a `Promise<ReadonlyRequestCookies>` in this Next.js version.
- **Server actions are in `app/actions.ts`** and are the primary mutation path. Forms use `action={someAction}`.
- **Uncontrolled set forms**: each existing set row is a server-action form; the `WorkoutForm` is a client component that adds a `blink` class to the Save button via `onChange` and `useState`.
- **Week anchors**: use `formatWeekKey(latestWorkoutDate)`, not `new Date()`, for weekly charts and judge/coach weekly logic.
- **Cold start**: keep the `4 sessions or 14 days` guard; do not let the judge or coach emit misleading decline signals on first workouts.
- **Prisma migrations**: require `DIRECT_URL`; use `DATABASE_URL` for runtime queries.
- **Adding exercises**: use `upsert` in `prisma/seed.mjs` or create via the UI; `isSystem` marks seeded exercises.
- **Tests**: `npm test` uses Vitest; add deterministic tests to `lib/coach/rules.test.ts` and `lib/judge.test.ts`.
- **No destructive git commands**; do not commit `.env` or secrets.

---

## 9. Feature boundaries

### In scope

- Single-user workout logging and editing.
- Exercise library (seeded + user-created).
- Per-exercise and per-muscle statistics.
- Deterministic judge + configurable coach.
- Settings for analysis windows.
- Vercel deployment with Neon free tier.

### Out of scope

- Multi-user accounts, social features, leaderboards.
- Wearable, food, or sleep integration.
- Native mobile app (it is a responsive web app).
- Auto-progression / automatic program generation.
- Changing the coach model away from Gemini `3.5-flash`/`3.1-flash-lite`.
