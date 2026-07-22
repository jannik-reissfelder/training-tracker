# Engineering Handoff — Training Tracker

> Read `docs/ARCHITECTURE.md` first for product and technical overview. This file is the practical "what to watch when you change things" guide.

## 1. The non-negotiables

- **Single user, single passphrase.** Do not build auth beyond `APP_PASSPHRASE` and `lib/auth.ts` unless explicitly asked.
- **Ground truth is the log.** Every analysis (stats, judge, coach) reads from `SetEntry`. If you patch data manually, invalidate/revalidate or restart the Next.js process.
- **Weekly analysis is anchored to the latest workout**, not `new Date()`. Use `formatWeekKey(latestWorkoutDate)` (from `lib/dates.ts`) anywhere you aggregate by week.
- **Cold start is 4 sessions or 14 days.** Until then, the judge must return `insufficient-data` and the coach should not emit false decline signals.
- **Prisma `DIRECT_URL`** is required for migrations (`pg_advisory_lock` does not work over pooled Neon). Runtime queries use `DATABASE_URL`.
- **`await cookies()`** — `cookies()` from `next/headers` is a Promise in Next.js 16 here.

## 2. How to extend the app safely

### Adding a new analysis metric

1. Compute it in `lib/judge.ts` and add an `Observation` to the `ProgressVerdict`.
2. Add the same metric (or an equivalent `Signal`) to `lib/coach/rules.ts` if the coach should react to it.
3. Expose it on `/stats` and/or the dashboard through `components/stats-charts.tsx`, `components/progress-verdict.tsx`, or `components/signal-alerts.tsx`.
4. Unit test both the judge and the coach rules with `vitest`.

### Adding a new chart

1. Fetch `SetEntry` data in the relevant server component (usually `app/(app)/stats/page.tsx`).
2. Keep week anchoring consistent with `components/stats-charts.tsx` (end at latest workout week, 12-week lookback).
3. Reuse `lib/dates.ts` helpers; do not re-implement week math.

### Adding an exercise field or a new model

1. Update `prisma/schema.prisma`.
2. Generate and write a migration (`npx prisma migrate dev` locally; Vercel deploy runs `prisma migrate deploy`).
3. Update `prisma/seed.mjs` if the field/model has seeded defaults.
4. Update TypeScript types in `lib/coach/rules.ts`, `lib/judge.ts`, and the server action mappers in `app/actions.ts`.
5. Add tests for any analysis that depends on the new field.

## 3. Common bugs and how to spot them

| Symptom | Likely cause | Fix |
|---|---|---|
| "0 sets this week" after a workout | Week anchor is `new Date()` instead of latest workout date | Use `formatWeekKey(latestWorkoutDate)` in judge/coach/charts |
| Progress Verdict says Declining on first workouts | Cold-start guard missing or too lenient | Keep `sessions.length < 4 \|\| daysSinceFirst < 14` |
| Charts show an empty current week | `stats-charts.tsx` end-week is `new Date()` | Compute `endWeek` from `latestWorkoutDate` |
| Adherence looks absurdly low | Using a hard 4-week target instead of elapsed time | Scale target by elapsed weeks (`consistencyWindowWeeks` max) |
| `prisma migrate deploy` fails on Vercel | `directUrl` missing or using pooled URL | Set `DIRECT_URL` (Neon direct/un-pooled) |
| Coach says "add more sets" contrary to philosophy | Prompt or Stage A rule over-prioritizes volume | Review `lib/coach/index.ts` system prompt and `lib/coach/rules.ts` thresholds |
| Save button does not blink on edit | `onChange` is on form instead of inputs | Attach `markDirty` to each input/select in `components/workout-form.tsx` |

## 4. Debugging checklist

1. Check the DB directly: `npx prisma studio` or query with `node -e` using `lib/db.ts`.
2. Run `npm test` after any change to judge/coach/rules.
3. Run `npm run lint` and `npm run build` before pushing.
4. Inspect server actions in `app/actions.ts` — most business logic flows through there.
5. The dashboard (`app/(app)/page.tsx`) and stats page (`app/(app)/stats/page.tsx`) are the main consumers of `analyze()` and `judgeProgress()`.
6. For LLM issues, set `GEMINI_API_KEY` to a real key; a missing or `mock` key throws and triggers fallback text.

## 5. Performance and correctness notes

- All server components query the full last 12 weeks of `SetEntry` rows. This is fine for a single user and small log, but if the user logs for years, move to aggregated SQL or Prisma group-by.
- The coach and judge do redundant DB fetches in `app/(app)/page.tsx` and `app/actions.ts`. A future refactor can extract a shared loader to guarantee identical inputs.
- `SetEntry.createdAt` is used to preserve set order inside a workout. Do not rely on `id` ordering.
- Units (`kg`/`lb`) are stored per set but never normalized. All math assumes the user picks one unit; the UI defaults to `kg`.

## 6. Things that look like bugs but are not

- The judge may disagree with the coach. That is by design: judge = pure stats, coach = stats + philosophy.
- The verdict can be `insufficient-data` for weeks. That is correct until 4+ sessions and 14+ days of history exist.
- The weekly x-axis labels are Monday dates. A 7/14 and 7/19 workout both appear in the `07-13` bar — that is the intended week grouping.
- The app intentionally does not auto-increment weights, generate programs, or add sets. Those remain human decisions.

## 7. Next natural improvements

- **Named templates / A-B program support**: right now "copy last workout" lists the last 5 sessions. True A/B templates would let the user save and name a session structure.
- **Supervision / plateaus**: when the judge turns `progressing`/`stagnating`/`declining`, surface a single highlighted action on the dashboard.
- **Better cold-start onboarding**: a one-time "log your first 3–4 sessions, then come back for a verdict" message instead of a generic `insufficient-data` card.
- **Data export**: CSV export of workouts/sets for backup.
- **Tests around date boundaries**: add tests for week rollover, timezone edge cases, and leap-year weeks using `lib/dates.ts`.

## 8. Contact points for agents

- Start with `docs/ARCHITECTURE.md` for intent and first principles.
- Keep this file next to it for the practical "do not break this" list.
- When in doubt, write a deterministic test in `lib/judge.test.ts` or `lib/coach/rules.test.ts` before changing code.
