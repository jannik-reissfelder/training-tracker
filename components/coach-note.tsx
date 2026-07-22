"use client";

import { useState, useTransition } from "react";
import { getCoachNote } from "@/app/actions";

export default function CoachNote() {
  const [note, setNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await getCoachNote();
      setNote(result);
    });
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Coach&apos;s Note</h2>
        <button type="button" className="btn primary" onClick={refresh} disabled={isPending}>
          {isPending ? "Generating..." : "Refresh"}
        </button>
      </div>
      {note ? (
        <p style={{ marginTop: "1rem" }}>{note}</p>
      ) : (
        <p className="muted" style={{ marginTop: "1rem" }}>Press Refresh to generate a note from your recent training data.</p>
      )}
    </section>
  );
}
