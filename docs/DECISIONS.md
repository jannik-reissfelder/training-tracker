# Decision Log, User Preferences & Learnings

> Read after `docs/ARCHITECTURE.md` and `docs/HANDOFF.md`. Append new entries at the top of the relevant section; keep entries short and dated. This file exists so cold-start agents do not re-learn context that was already settled with the user.

## 1. User profile & preferences (owner: Jannik)

- **Mobile first.** The app is used almost exclusively on a phone, in the gym, while training. Every workout-entry change must be judged on a ~390 px wide portrait viewport first; desktop is secondary.
- **Workout logging is the primary flow.** Typical session: open app → "Log workout" → start Workout A or B → adjust a few reps/weights → save. Optimise this path above everything else.
- **Program = Workout A / Workout B.** The user alternates two fixed sessions. He wants the latest A or B session reused as the starting point (exercises, sets, reps, weights, unit, RIR/RPE, notes), not a generic "copy any recent workout" list.
- **No noise in the UI.** No recursive "copied from copied from …" notes, no controls that permanently occupy screen space, minimal scrolling.
- **Vertical, labeled inputs** on mobile; no horizontal rows that need sideways scrolling or squeezed fields.
- **Communication.** Writes in German or English (casual, typos common); prefers short answers. Trusts the agent to merge after validation, but wants realistic end-to-end checks on **Production** when asked to "test my flow".
- **Wants decisions, learnings and preferences documented** in the repo (this file + architecture/handoff) after every meaningful change.

## 2. Product / UX decisions

| Date | Decision | Why | Where |
|---|---|---|---|
| 2026-10-04 | "Add set" form under each exercise is **collapsed by default**; a small `+ Add set` button in the exercise header expands it below the existing sets; `Done` collapses it. Only one exercise's form is open at a time. The form stays open after submitting so several sets can be added in a row (fields reset via `key={group.sets.length}`); the unit defaults to the last set's unit. | The always-visible 6-field form roughly doubled the height of every exercise card on mobile and made scrolling through a workout tedious. Adding a set is an occasional action; editing copied sets is the common one. | `components/workout-form.tsx` (`addSetExerciseId` state) |
| 2026-10-04 | "Remove exercise" moved to a small right-aligned button at the bottom of each exercise card. | Rarely used, destructive; should not sit above the sets or take full width. | `components/workout-form.tsx`, `.exercise-remove-form` |
| 2026-09 | Dedicated **Workout A / Workout B** starters replace the "copy one of the last 5 workouts" list. Each starter copies the latest workout whose notes identify it as A or B (`Workout A`, `A`, `A (…)` …), searching the latest 50 workouts. | Matches how the user actually trains (A/B alternation) and reuses the latest numbers automatically. | `app/(app)/workouts/new/page.tsx`, `createWorkoutFromTemplate` in `app/actions.ts` |
| 2026-09 | Copied workouts get notes exactly `Workout A` / `Workout B`. | Old copy flow produced "Copied from Copied from 30/08/2026"; the stable note is also what the A/B detection keys on. | `createWorkoutFromTemplate` |
| 2026-09 | Removed the sticky top workout-details bar and sticky bottom save/finish bar. | On mobile they covered the input being typed into (especially with the keyboard open). Plain in-flow controls are more reliable. | `components/workout-form.tsx` |
| 2026-09 | Set fields render as full-width labeled vertical fields under 40rem; compact horizontal rows on wider screens. | Thumb-friendly entry on phones without losing density on desktop. | `.set-editor`, `.set-field` in `app/globals.css` |

## 3. Technical / ops learnings

- **Vercel env vars are per environment.** Preview builds failed (`PrismaConfigEnvError: Missing required environment variable: DATABASE_URL`) because `DATABASE_URL` existed only for Production. Check Production *and* Preview when adding variables.
- **`APP_PASSPHRASE` drift.** Preview and Production once held different passphrases than the one the user gave the agent. As of 2026-10 both Vercel environments are synchronized with the passphrase stored in Devin secrets. If login fails with "Invalid passphrase", compare values before debugging code. Never commit the passphrase.
- **Local build needs a database.** `npm run build` runs migrations/seed and prerenders DB-backed pages; without Postgres it fails at prerender. For local checks use `npm run lint`, `npx tsc --noEmit` (after `prisma generate` with any placeholder `DATABASE_URL`/`DIRECT_URL`), and `npm test`; rely on the Vercel Preview build for the full build.
- **Node** may not be on PATH in agent VMs; source nvm first.
- **Test data hygiene.** UI tests run against the real (single-user) database. Every mock workout created during a test must be deleted afterwards and the workout count verified against the starting state.
- **Automated number inputs** sometimes need a select-all + retype to replace values reliably during browser automation; this is a test-harness quirk, not an app bug.

## 4. Testing history

| Date | Scope | Result | Gaps |
|---|---|---|---|
| 2026-09 | Preview, ~390×844 mobile emulation: login, A/B starters (18 A sets / 17 B sets copied incl. reps, weights, unit, RIR/RPE, notes), exact `Workout A/B` notes, vertical editing + persistence, adding a new exercise, scrolling without covered inputs, repeating A copies latest values. Temporary workouts deleted, original 9 workouts restored. | Pass | Physical iPhone Safari and on-screen keyboard not tested; quick "Add set" on an existing exercise not exercised. |
| 2026-09 | Production post-merge "typical gym flow" (start latest A/B, ~5 rep/weight changes, save, verify, delete). | Not completed: blocked by stale Production `APP_PASSPHRASE` (fixed + redeployed), then test tooling quota ran out. No production data was touched. | Rerun when possible. |

## 5. Open ideas / follow-ups

- Prefill the collapsed "Add set" form with the previous set's reps/weight (currently only unit) if the user wants even faster entry.
- Optional per-exercise collapse of the existing sets list for very long workouts.
- Test on a physical iPhone (Safari keyboard behaviour).
