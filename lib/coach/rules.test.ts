import { describe, it, expect } from "vitest";
import { analyze, type CoachConfig, type SetEntry } from "@/lib/coach/rules";
import { addDaysUTC, weeksAgo, startOfWeekUTC } from "@/lib/dates";

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

function set(
  overrides: Partial<SetEntry> & { workoutId: string; date: Date; exerciseId: string }
): SetEntry {
  return {
    exerciseName: "Bench Press",
    muscleGroups: ["chest"],
    reps: 8,
    weight: 80,
    unit: "kg",
    ...overrides,
  };
}

function workoutDate(daysAgo: number, today: Date) {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

describe("Stage A rules engine", () => {
  it("detects a positive trend when recent 1RM is up over previous sessions", () => {
    const today = new Date("2026-07-12");
    const entries: SetEntry[] = [
      set({ workoutId: "w1", date: workoutDate(28, today), exerciseId: "ex1", weight: 80, reps: 8 }),
      set({ workoutId: "w2", date: workoutDate(21, today), exerciseId: "ex1", weight: 82, reps: 8 }),
      set({ workoutId: "w3", date: workoutDate(14, today), exerciseId: "ex1", weight: 85, reps: 8 }),
      set({ workoutId: "w4", date: workoutDate(7, today), exerciseId: "ex1", weight: 87, reps: 8 }),
    ];

    const signals = analyze(entries, config, today);
    const trend = signals.find((s) => s.type === "positive-trend");

    expect(trend).toBeDefined();
    expect(trend!.exerciseId).toBe("ex1");
    expect(trend!.details.recentAverage).toBeGreaterThan(trend!.details.previousAverage as number);
  });

  it("detects stagnation when an exercise is flat for the configured window", () => {
    const today = new Date("2026-07-12");
    const entries: SetEntry[] = [
      set({ workoutId: "w1", date: workoutDate(28, today), exerciseId: "ex1", weight: 80, reps: 8 }),
      set({ workoutId: "w2", date: workoutDate(21, today), exerciseId: "ex1", weight: 80, reps: 8 }),
      set({ workoutId: "w3", date: workoutDate(14, today), exerciseId: "ex1", weight: 80, reps: 8 }),
      set({ workoutId: "w4", date: workoutDate(7, today), exerciseId: "ex1", weight: 80, reps: 8 }),
    ];

    const signals = analyze(entries, config, today);
    const stagnation = signals.find((s) => s.type === "stagnation");

    expect(stagnation).toBeDefined();
    expect(stagnation!.exerciseId).toBe("ex1");
    expect(stagnation!.details.min1RM).toBe(stagnation!.details.max1RM);
  });

  it("detects a volume drop when a muscle group's last week falls below baseline", () => {
    const today = new Date("2026-07-12");
    const entries: SetEntry[] = [];

    for (let week = 4; week >= 2; week--) {
      const startOfWeek = startOfWeekUTC(weeksAgo(week, today));
      for (let i = 0; i < 6; i++) {
        entries.push(
          set({
            workoutId: `w${week}-${i}`,
            date: addDaysUTC(startOfWeek, i),
            exerciseId: "ex1",
            muscleGroups: ["chest"],
            weight: 80,
            reps: 8,
          })
        );
      }
    }

    // last completed week has only 1 chest set
    entries.push(
      set({
        workoutId: "w1-0",
        date: startOfWeekUTC(weeksAgo(1, today)),
        exerciseId: "ex1",
        muscleGroups: ["chest"],
        weight: 80,
        reps: 8,
      })
    );

    const signals = analyze(entries, config, today);
    const drop = signals.find((s) => s.type === "volume-drop" && s.muscleGroup === "chest");

    expect(drop).toBeDefined();
    expect(drop!.details.lastCompleted).toBeLessThan(drop!.details.baselineAverage as number);
  });

  it("detects a consistency drop when sessions miss the frequency target", () => {
    const today = new Date("2026-07-12");
    const entries: SetEntry[] = [
      set({ workoutId: "w1", date: workoutDate(12, today), exerciseId: "ex1" }),
      set({ workoutId: "w2", date: workoutDate(5, today), exerciseId: "ex1" }),
    ];

    const signals = analyze(entries, config, today);
    const consistency = signals.find((s) => s.type === "consistency-drop");

    expect(consistency).toBeDefined();
    expect(consistency!.details.sessions).toBe(2);
    expect(consistency!.details.target).toBe(4);
  });

  it("returns no signals when training is consistent and progressing", () => {
    const today = new Date("2026-07-12");
    const entries: SetEntry[] = [
      set({ workoutId: "w1", date: workoutDate(7, today), exerciseId: "ex1", weight: 80, reps: 8 }),
      set({ workoutId: "w2", date: workoutDate(5, today), exerciseId: "ex1", weight: 82, reps: 8 }),
      set({ workoutId: "w3", date: workoutDate(3, today), exerciseId: "ex1", weight: 84, reps: 8 }),
      set({ workoutId: "w4", date: workoutDate(1, today), exerciseId: "ex1", weight: 86, reps: 8 }),
    ];

    const signals = analyze(entries, config, today);

    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe("positive-trend");
  });
});
