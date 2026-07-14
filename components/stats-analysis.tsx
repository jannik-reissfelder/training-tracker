"use client";

import { useState, useTransition } from "react";
import { analyzeStats, coachStats } from "@/app/actions";
import ProgressVerdict from "@/components/progress-verdict";
import type { ProgressVerdict as ProgressVerdictType } from "@/lib/judge";

export default function StatsAnalysis({ verdict }: { verdict: ProgressVerdictType }) {
  const [judgeText, setJudgeText] = useState<string | null>(null);
  const [coachText, setCoachText] = useState<string | null>(null);
  const [isJudgePending, startJudge] = useTransition();
  const [isCoachPending, startCoach] = useTransition();

  function askJudge() {
    setJudgeText(null);
    startJudge(async () => {
      try {
        const text = await analyzeStats();
        setJudgeText(text);
      } catch {
        setJudgeText("The judge could not analyze the stats right now. Try again.");
      }
    });
  }

  function askCoach() {
    setCoachText(null);
    startCoach(async () => {
      try {
        const text = await coachStats();
        setCoachText(text);
      } catch {
        setCoachText("The coach could not respond right now. Try again.");
      }
    });
  }

  return (
    <section className="card">
      <ProgressVerdict verdict={verdict} expanded />

      <div className="row" style={{ marginTop: "1rem", gap: "0.75rem" }}>
        <button
          type="button"
          className="btn"
          onClick={askJudge}
          disabled={isJudgePending || isCoachPending}
        >
          {isJudgePending ? "Judging..." : "Judge me"}
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={askCoach}
          disabled={isJudgePending || isCoachPending}
        >
          {isCoachPending ? "Coaching..." : "Coach's take"}
        </button>
      </div>

      {judgeText && (
        <div className="card" style={{ marginTop: "1rem", background: "var(--muted-bg, #f3f4f6)" }}>
          <h3>Judge&apos;s analysis</h3>
          <p style={{ marginTop: "0.5rem" }}>{judgeText}</p>
        </div>
      )}

      {coachText && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Coach&apos;s take</h3>
          <p style={{ marginTop: "0.5rem" }}>{coachText}</p>
        </div>
      )}
    </section>
  );
}
