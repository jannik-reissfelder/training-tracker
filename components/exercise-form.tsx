"use client";

import { useActionState } from "react";
import { createExercise } from "@/app/actions";

export default function ExerciseForm() {
  const [state, formAction] = useActionState(createExercise, { error: "" });

  return (
    <form action={formAction} className="card stack" style={{ maxWidth: "32rem" }}>
      <h2>Add exercise</h2>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required />

      <label htmlFor="muscleGroups">Muscle groups (comma-separated)</label>
      <input id="muscleGroups" name="muscleGroups" placeholder="e.g. quads, glutes" required />

      <label htmlFor="movementPattern">Movement pattern</label>
      <select id="movementPattern" name="movementPattern">
        <option value="">Select</option>
        <option value="squat">squat</option>
        <option value="hinge">hinge</option>
        <option value="push">push</option>
        <option value="pull">pull</option>
        <option value="carry">carry</option>
        <option value="core">core</option>
        <option value="other">other</option>
      </select>

      {state?.error && <p className="muted" style={{ color: "var(--danger)" }}>{state.error}</p>}

      <button type="submit" className="btn primary">Add exercise</button>
    </form>
  );
}
