import { describe, it, expect } from "vitest";
import { getCoachNote, type LLM } from "@/lib/coach";
import type { CoachConfig, SetEntry } from "@/lib/coach/rules";

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

function makeEntry(overrides: Partial<SetEntry> & { workoutId: string; date: Date }): SetEntry {
  return {
    exerciseId: "ex1",
    exerciseName: "Bench Press",
    muscleGroups: ["chest"],
    reps: 8,
    weight: 80,
    unit: "kg",
    ...overrides,
  };
}

describe("Stage B coach note", () => {
  it("passes signals and config to the LLM and returns its response", async () => {
    const today = new Date("2026-07-12");
    const entries: SetEntry[] = [
      makeEntry({ workoutId: "w1", date: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), weight: 80, reps: 8 }),
      makeEntry({ workoutId: "w2", date: today, weight: 82, reps: 8 }),
    ];

    const mockLLM: LLM = async ({ systemPrompt, userPrompt }) => {
      expect(systemPrompt).toContain("2 hard sets per exercise");
      expect(userPrompt).toContain("Signals");
      return "Mocked coach note.";
    };

    const note = await getCoachNote({ entries, config, llm: mockLLM });
    expect(note).toBe("Mocked coach note.");
  });

  it("falls back to a deterministic note when the LLM throws", async () => {
    const today = new Date("2026-07-12");
    const entries: SetEntry[] = [
      makeEntry({ workoutId: "w1", date: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), weight: 80, reps: 8 }),
      makeEntry({ workoutId: "w2", date: today, weight: 80, reps: 8 }),
    ];

    const failingLLM: LLM = async () => {
      throw new Error("LLM unavailable");
    };

    const note = await getCoachNote({ entries, config, llm: failingLLM });
    expect(note.length).toBeGreaterThan(0);
  });
});
