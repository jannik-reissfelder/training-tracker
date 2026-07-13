"use client";

import { useState, useTransition } from "react";
import { explainSignal } from "@/app/actions";
import type { Signal } from "@/lib/coach/rules";

type SignalTone = "positive" | "warning";

function signalTone(signal: Signal): SignalTone {
  switch (signal.type) {
    case "positive-trend":
      return "positive";
    case "stagnation":
    case "volume-drop":
    case "consistency-drop":
      return "warning";
    default:
      return "warning";
  }
}

function signalIcon(signal: Signal): string {
  switch (signal.type) {
    case "positive-trend":
      return "↑";
    case "stagnation":
      return "—";
    case "volume-drop":
      return "▼";
    case "consistency-drop":
      return "⚠";
    default:
      return "•";
  }
}

function signalLabel(signal: Signal): string {
  switch (signal.type) {
    case "positive-trend":
      return "Positive trend";
    case "stagnation":
      return "Stagnation";
    case "volume-drop":
      return "Volume drop";
    case "consistency-drop":
      return "Consistency drop";
    default:
      return signal.type;
  }
}

function signalKey(signal: Signal): string {
  return `${signal.type}-${signal.exerciseId || signal.muscleGroup || ""}`;
}

export default function SignalAlerts({ signals }: { signals: Signal[] }) {
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function analyze(signal: Signal) {
    const key = signalKey(signal);
    setLoadingId(key);
    startTransition(async () => {
      try {
        const text = await explainSignal(signal);
        setExplanations((prev) => ({ ...prev, [key]: text }));
      } catch {
        setExplanations((prev) => ({ ...prev, [key]: "Could not analyze this signal. Please try again." }));
      } finally {
        setLoadingId(null);
      }
    });
  }

  if (signals.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <h2>Training signals</h2>
      <ul className="stack" style={{ gap: "0.75rem", marginTop: "1rem" }}>
        {signals.map((signal) => {
          const key = signalKey(signal);
          const tone = signalTone(signal);
          const isLoading = loadingId === key && isPending;
          return (
            <li
              key={key}
              className="row"
              style={{
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  flex: 1,
                  minWidth: "12rem",
                }}
              >
                <span
                  style={{
                    fontSize: "1.25rem",
                    color: tone === "warning" ? "var(--danger, #dc2626)" : "var(--success, #16a34a)",
                  }}
                >
                  {signalIcon(signal)}
                </span>
                <div>
                  <strong>{signalLabel(signal)}</strong>
                  <p className="muted" style={{ margin: 0, marginTop: "0.25rem" }}>
                    {signal.message}
                  </p>
                </div>
              </div>
              {tone === "warning" && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => analyze(signal)}
                  disabled={isLoading}
                >
                  {isLoading ? "Analyzing..." : "Analyze"}
                </button>
              )}
              {explanations[key] && (
                <p className="muted" style={{ width: "100%", marginTop: "0.5rem" }}>
                  {explanations[key]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
