import { describe, it, expect } from "vitest";
import { judgeProgress, type JudgeEntry } from "@/lib/judge";
import type { CoachConfig } from "@/lib/coach/rules";

const config: CoachConfig = {
  splitType: "full body",
  frequencyMin: 2,
  frequencyMax: 3,
  primaryGoal: "hypertrophy + functional fitness",
  targetSetsPerExercise: 2,
  stagnationWindowWeeks: 4,
  volumeBaselineWeeks: 4,
  volumeDropThreshold: 2,
  consistencyWindowWeeks: 2,
};

function makeEntry(
  overrides: Partial<JudgeEntry> & { date: Date; workoutId: string; exerciseId: string }
): JudgeEntry {
  const base = {
    exerciseName: overrides.exerciseName || "Exercise",
    muscleGroups: overrides.muscleGroups || ["quadriceps"],
    reps: overrides.reps ?? 8,
    weight: overrides.weight ?? 100,
    unit: overrides.unit ?? "kg",
    rir: overrides.rir,
    rpe: overrides.rpe,
    createdAt: overrides.createdAt ?? overrides.date,
  };
  return { ...base, ...overrides } as JudgeEntry;
}

function daysAgo(days: number, from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d;
}

function entry(
  date: Date,
  workoutId: string,
  exerciseId: string,
  weight: number,
  reps: number,
  rpe?: number,
  createdAt?: Date
): JudgeEntry {
  return makeEntry({
    date,
    workoutId,
    exerciseId,
    exerciseName: exerciseId,
    weight,
    reps,
    rpe,
    createdAt: createdAt ?? date,
  });
}

describe("judgeProgress", () => {
  it("returns insufficient data when no entries", () => {
    const verdict = judgeProgress([], config);
    expect(verdict.status).toBe("insufficient-data");
  });

  it("detects e1RM progression", () => {
    const e1 = entry(daysAgo(40), "w1", "squat", 100, 8, 8);
    const e2 = entry(daysAgo(35), "w2", "squat", 100, 8, 8);
    const e3 = entry(daysAgo(5), "w3", "squat", 110, 8, 8);
    const e4 = entry(daysAgo(4), "w4", "squat", 110, 8, 8);
    const verdict = judgeProgress([e1, e2, e3, e4], config);
    expect(verdict.observations.some((o) => o.type === "positive" && o.label.includes("e1RM"))).toBe(true);
  });

  it("detects e1RM stagnation", () => {
    const e1 = entry(daysAgo(40), "w1", "squat", 100, 8, 8);
    const e2 = entry(daysAgo(35), "w2", "squat", 100, 8, 8);
    const e3 = entry(daysAgo(5), "w3", "squat", 100, 8, 8);
    const e4 = entry(daysAgo(4), "w4", "squat", 100, 8, 8);
    const verdict = judgeProgress([e1, e2, e3, e4], config);
    expect(verdict.observations.some((o) => o.type === "warning" && o.label.includes("e1RM"))).toBe(true);
  });

  it("detects RPE drift at the same load/reps", () => {
    const e1 = entry(daysAgo(21), "w1", "squat", 100, 8, 8);
    const e2 = entry(daysAgo(5), "w2", "squat", 100, 8, 9);
    const verdict = judgeProgress([e1, e2], config);
    expect(verdict.observations.some((o) => o.type === "negative" && o.label.includes("RPE drift"))).toBe(true);
  });

  it("flags low session adherence", () => {
    const e1 = entry(daysAgo(5), "w1", "squat", 100, 8);
    const e2 = entry(daysAgo(5), "w1", "squat", 100, 8);
    const verdict = judgeProgress([e1, e2], config);
    expect(verdict.observations.some((o) => o.scope === "global" && o.label.includes("adherence"))).toBe(true);
  });

  it("flags high set-to-set rep drop-off", () => {
    const base = daysAgo(5);
    const e1 = makeEntry({ date: base, workoutId: "w1", exerciseId: "squat", exerciseName: "Squat", weight: 100, reps: 10, rpe: 9, createdAt: new Date(base.getTime()) });
    const e2 = makeEntry({ date: base, workoutId: "w1", exerciseId: "squat", exerciseName: "Squat", weight: 100, reps: 7, rpe: 10, createdAt: new Date(base.getTime() + 1000) });
    const verdict = judgeProgress([e1, e2], config);
    expect(verdict.observations.some((o) => o.label.includes("rep drop-off"))).toBe(true);
  });
});
