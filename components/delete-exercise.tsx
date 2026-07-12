"use client";

import { useActionState } from "react";
import { deleteExercise } from "@/app/actions";

export default function DeleteExerciseButton({ id }: { id: string }) {
  const [state, formAction] = useActionState(deleteExercise, { error: "" });

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      {state?.error && <p className="muted" style={{ color: "var(--danger)" }}>{state.error}</p>}
      <button type="submit" className="btn danger">Delete</button>
    </form>
  );
}
