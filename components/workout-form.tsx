"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSet, updateSet, deleteSet, updateWorkout, finishWorkout, deleteWorkout, addExerciseSets, deleteExerciseFromWorkout } from "@/app/actions";

interface ExerciseOption {
  id: string;
  name: string;
}

interface SetData {
  id: string;
  exerciseId: string;
  exerciseName: string;
  reps: number;
  weight: number;
  unit: string;
  rir?: number | null;
  rpe?: number | null;
  notes?: string | null;
}

interface WorkoutData {
  id: string;
  date: string;
  notes?: string | null;
  setEntries: SetData[];
}

interface NewSet {
  reps: string;
  weight: string;
  unit: string;
  rir: string;
  rpe: string;
  notes: string;
}

interface GroupedSets {
  exerciseId: string;
  exerciseName: string;
  sets: SetData[];
}

const emptySet: NewSet = {
  reps: "",
  weight: "",
  unit: "kg",
  rir: "",
  rpe: "",
  notes: "",
};

function groupByExercise(setEntries: SetData[]): GroupedSets[] {
  const map = new Map<string, GroupedSets>();
  for (const set of setEntries) {
    const group = map.get(set.exerciseId);
    if (group) {
      group.sets.push(set);
    } else {
      map.set(set.exerciseId, {
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        sets: [set],
      });
    }
  }
  return Array.from(map.values());
}

export default function WorkoutForm({
  workout,
  exercises,
}: {
  workout: WorkoutData;
  exercises: ExerciseOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [newSets, setNewSets] = useState<NewSet[]>([{ ...emptySet }]);
  const [error, setError] = useState<string | null>(null);
  const [dirtySetIds, setDirtySetIds] = useState<Set<string>>(new Set());

  function markDirty(setId: string) {
    setDirtySetIds((prev) => new Set(prev).add(setId));
  }

  function clearDirty(setId: string) {
    setDirtySetIds((prev) => {
      const next = new Set(prev);
      next.delete(setId);
      return next;
    });
  }

  const grouped = groupByExercise(workout.setEntries);

  function handleAddRow() {
    setNewSets((prev) => [...prev, { ...emptySet }]);
  }

  function handleRemoveRow(index: number) {
    setNewSets((prev) => prev.filter((_, i) => i !== index));
  }

  function handleRowChange(index: number, field: keyof NewSet, value: string) {
    setNewSets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleSaveExercise() {
    if (!selectedExerciseId) return;

    const validSets = newSets.filter((s) => s.reps.trim() !== "" && s.weight.trim() !== "");
    if (validSets.length === 0) {
      setError("Add at least one set with reps and weight.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await addExerciseSets({
          workoutId: workout.id,
          exerciseId: selectedExerciseId,
          sets: validSets,
        });
        setSelectedExerciseId("");
        setNewSets([{ ...emptySet }]);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save sets.");
      }
    });
  }

  return (
    <div className="stack">
      <form action={updateWorkout} className="card stack">
        <input name="id" type="hidden" value={workout.id} />
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={workout.date} required />

        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={workout.notes || ""} />

        <div className="row">
          <button type="submit" className="btn primary">
            Save workout
          </button>
          <button type="submit" formAction={finishWorkout} className="btn">
            Save & finish
          </button>
          <button type="submit" formAction={deleteWorkout} className="btn danger">
            Delete
          </button>
        </div>
      </form>

      <h2>Exercises</h2>

      {grouped.length === 0 ? (
        <p className="muted">No exercises yet. Add the first one below.</p>
      ) : (
        <div className="stack">
          {grouped.map((group) => (
            <section key={group.exerciseId} className="card stack">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>{group.exerciseName}</h3>
                <form
                  action={createSet}
                  key={group.sets.length}
                  className="row"
                  style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}
                >
                  <input type="hidden" name="workoutId" value={workout.id} />
                  <input type="hidden" name="exerciseId" value={group.exerciseId} />
                  <input
                    name="reps"
                    type="number"
                    min={0}
                    required
                    placeholder="reps"
                    style={{ width: "4rem" }}
                  />
                  <span>×</span>
                  <input
                    name="weight"
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    placeholder="kg"
                    style={{ width: "4rem" }}
                  />
                  <select name="unit" defaultValue="kg" required style={{ width: "3.5rem" }}>
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                  <input
                    name="rir"
                    type="number"
                    min={0}
                    max={10}
                    placeholder="RIR"
                    style={{ width: "3.5rem" }}
                  />
                  <input
                    name="rpe"
                    type="number"
                    min={0}
                    max={10}
                    step="0.5"
                    placeholder="RPE"
                    style={{ width: "3.5rem" }}
                  />
                  <input
                    name="notes"
                    placeholder="notes"
                    style={{ minWidth: "6rem", flex: 1 }}
                  />
                  <button type="submit" className="btn primary">
                    Add set
                  </button>
                </form>
                <form
                  action={deleteExerciseFromWorkout}
                  className="row"
                  style={{ gap: "0.5rem", alignItems: "center" }}
                >
                  <input type="hidden" name="workoutId" value={workout.id} />
                  <input type="hidden" name="exerciseId" value={group.exerciseId} />
                  <button type="submit" className="btn danger">
                    Remove exercise
                  </button>
                </form>
              </div>

              <ul className="stack" style={{ gap: "0.5rem", listStyle: "none", padding: 0, margin: 0 }}>
                {group.sets.map((set) => (
                  <li key={set.id}>
                    <form
                      action={updateSet}
                      onSubmit={() => clearDirty(set.id)}
                      className="row"
                      style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}
                    >
                      <input type="hidden" name="id" value={set.id} />
                      <input type="hidden" name="workoutId" value={workout.id} />
                      <input
                        name="reps"
                        type="number"
                        min={0}
                        defaultValue={set.reps}
                        onChange={() => markDirty(set.id)}
                        required
                        style={{ width: "4rem" }}
                      />
                      <span>×</span>
                      <input
                        name="weight"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={set.weight}
                        onChange={() => markDirty(set.id)}
                        required
                        style={{ width: "4rem" }}
                      />
                      <select
                        name="unit"
                        defaultValue={set.unit}
                        onChange={() => markDirty(set.id)}
                        required
                        style={{ width: "3.5rem" }}
                      >
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>
                      <input
                        name="rir"
                        type="number"
                        min={0}
                        max={10}
                        defaultValue={set.rir ?? ""}
                        onChange={() => markDirty(set.id)}
                        placeholder="RIR"
                        style={{ width: "3.5rem" }}
                      />
                      <input
                        name="rpe"
                        type="number"
                        min={0}
                        max={10}
                        step="0.5"
                        defaultValue={set.rpe ?? ""}
                        onChange={() => markDirty(set.id)}
                        placeholder="RPE"
                        style={{ width: "3.5rem" }}
                      />
                      <input
                        name="notes"
                        defaultValue={set.notes || ""}
                        onChange={() => markDirty(set.id)}
                        placeholder="notes"
                        style={{ minWidth: "6rem", flex: 1 }}
                      />
                      <button
                        type="submit"
                        className={dirtySetIds.has(set.id) ? "btn primary blink" : "btn"}
                      >
                        Save
                      </button>
                      <button type="submit" formAction={deleteSet} className="btn danger">
                        Delete
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Add exercise</h3>
        <p className="muted" style={{ margin: 0 }}>
          Pick an exercise, then log all of its sets for this workout.
        </p>

        <label htmlFor="newExerciseId">Exercise</label>
        <select
          id="newExerciseId"
          value={selectedExerciseId}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
        >
          <option value="">Select exercise</option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        {selectedExerciseId && (
          <div className="stack" style={{ gap: "0.75rem" }}>
            {newSets.map((s, i) => (
              <div key={i} className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min={0}
                  value={s.reps}
                  onChange={(e) => handleRowChange(i, "reps", e.target.value)}
                  placeholder="reps"
                  required
                  style={{ width: "4rem" }}
                />
                <span>×</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={s.weight}
                  onChange={(e) => handleRowChange(i, "weight", e.target.value)}
                  placeholder="kg"
                  required
                  style={{ width: "4rem" }}
                />
                <select
                  value={s.unit}
                  onChange={(e) => handleRowChange(i, "unit", e.target.value)}
                  style={{ width: "3.5rem" }}
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={s.rir}
                  onChange={(e) => handleRowChange(i, "rir", e.target.value)}
                  placeholder="RIR"
                  style={{ width: "3.5rem" }}
                />
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.5"
                  value={s.rpe}
                  onChange={(e) => handleRowChange(i, "rpe", e.target.value)}
                  placeholder="RPE"
                  style={{ width: "3.5rem" }}
                />
                <input
                  value={s.notes}
                  onChange={(e) => handleRowChange(i, "notes", e.target.value)}
                  placeholder="notes"
                  style={{ minWidth: "6rem", flex: 1 }}
                />
                {newSets.length > 1 && (
                  <button type="button" className="btn danger" onClick={() => handleRemoveRow(i)}>
                    Remove
                  </button>
                )}
              </div>
            ))}

            {error && <p className="muted" style={{ color: "var(--danger, #ef4444)" }}>{error}</p>}

            <div className="row">
              <button type="button" className="btn" onClick={handleAddRow}>
                Add another set
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleSaveExercise}
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save exercise"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
