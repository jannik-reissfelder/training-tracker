"use client";

import { createSet, updateSet, deleteSet, updateWorkout, deleteWorkout } from "@/app/actions";

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

export default function WorkoutForm({
  workout,
  exercises,
}: {
  workout: WorkoutData;
  exercises: ExerciseOption[];
}) {
  return (
    <div className="stack">
      <form action={updateWorkout} className="card stack">
        <input name="id" type="hidden" value={workout.id} />
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={workout.date} required />

        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={workout.notes || ""} />

        <div className="row">
          <button type="submit" className="btn primary">Update workout</button>
          <button type="submit" formAction={deleteWorkout} className="btn danger">Delete</button>
        </div>
      </form>

      <h2>Sets</h2>

      {workout.setEntries.length === 0 ? (
        <p className="muted">No sets yet. Add the first one below.</p>
      ) : (
        <div className="stack">
          {workout.setEntries.map((set) => (
            <form key={set.id} action={updateSet} className="card stack">
              <input type="hidden" name="id" value={set.id} />
              <input type="hidden" name="workoutId" value={workout.id} />

              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{set.exerciseName}</strong>
                <button type="submit" formAction={deleteSet} className="btn danger">
                  Delete
                </button>
              </div>

              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(6rem, 1fr))" }}>
                <div>
                  <label>Reps</label>
                  <input name="reps" type="number" defaultValue={set.reps} min={0} required />
                </div>
                <div>
                  <label>Weight</label>
                  <input name="weight" type="number" step="0.01" defaultValue={set.weight} min={0} required />
                </div>
                <div>
                  <label>Unit</label>
                  <select name="unit" defaultValue={set.unit} required>
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
                <div>
                  <label>RIR</label>
                  <input name="rir" type="number" defaultValue={set.rir ?? ""} min={0} max={10} />
                </div>
                <div>
                  <label>RPE</label>
                  <input name="rpe" type="number" defaultValue={set.rpe ?? ""} min={0} max={10} step="0.5" />
                </div>
              </div>

              <div>
                <label>Notes</label>
                <input name="notes" defaultValue={set.notes || ""} />
              </div>

              <button type="submit" className="btn">Save set</button>
            </form>
          ))}
        </div>
      )}

      <form action={createSet} className="card stack">
        <input type="hidden" name="workoutId" value={workout.id} />
        <h3>Add set</h3>
        <label htmlFor="exerciseId">Exercise</label>
        <select id="exerciseId" name="exerciseId" required>
          <option value="">Select exercise</option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(6rem, 1fr))" }}>
          <div>
            <label>Reps</label>
            <input name="reps" type="number" min={0} defaultValue={8} required />
          </div>
          <div>
            <label>Weight</label>
            <input name="weight" type="number" step="0.01" min={0} defaultValue={0} required />
          </div>
          <div>
            <label>Unit</label>
            <select name="unit" defaultValue="kg" required>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </div>
          <div>
            <label>RIR</label>
            <input name="rir" type="number" min={0} max={10} />
          </div>
          <div>
            <label>RPE</label>
            <input name="rpe" type="number" min={0} max={10} step="0.5" />
          </div>
        </div>

        <div>
          <label>Notes</label>
          <input name="notes" />
        </div>

        <button type="submit" className="btn primary">Add set</button>
      </form>
    </div>
  );
}
