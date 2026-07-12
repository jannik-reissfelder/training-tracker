"use client";

import { createWorkout } from "@/app/actions";

export default function NewWorkoutPage() {
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="stack" style={{ maxWidth: "32rem" }}>
      <h1>Log workout</h1>
      <form action={createWorkout} className="stack">
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={today} required />

        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} placeholder="Optional session notes" />

        <div className="row">
          <button type="submit" className="btn primary">Start workout</button>
        </div>
      </form>
    </div>
  );
}
