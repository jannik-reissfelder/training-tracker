import type { ProgressVerdict } from "@/lib/judge";

function statusColor(status: ProgressVerdict["status"]): string {
  switch (status) {
    case "progressing":
      return "var(--success, #16a34a)";
    case "stagnating":
      return "var(--warning, #f59e0b)";
    case "declining":
      return "var(--danger, #dc2626)";
    case "insufficient-data":
      return "var(--muted, #6b7280)";
    default:
      return "var(--muted, #6b7280)";
  }
}

function statusLabel(status: ProgressVerdict["status"]): string {
  switch (status) {
    case "progressing":
      return "Progressing";
    case "stagnating":
      return "Stagnating";
    case "declining":
      return "Declining";
    case "insufficient-data":
      return "Not enough data";
    default:
      return status;
  }
}

function icon(type: string): string {
  switch (type) {
    case "positive":
      return "↑";
    case "negative":
      return "↓";
    case "warning":
      return "⚠";
    default:
      return "•";
  }
}

export default function ProgressVerdict({
  verdict,
  expanded = false,
}: {
  verdict: ProgressVerdict;
  expanded?: boolean;
}) {
  const observationsList = (
    <ul className="stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
      {verdict.observations.map((obs, i) => (
        <li key={i} className="row" style={{ alignItems: "flex-start", gap: "0.5rem" }}>
          <span
            style={{
              color:
                obs.type === "positive"
                  ? "var(--success, #16a34a)"
                  : obs.type === "negative"
                  ? "var(--danger, #dc2626)"
                  : "var(--warning, #f59e0b)",
              fontSize: "1.1rem",
            }}
          >
            {icon(obs.type)}
          </span>
          <div>
            <strong>{obs.label}</strong>
            <p className="muted" style={{ margin: 0, marginTop: "0.25rem" }}>
              {obs.message}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="card">
      <h2>Progress Verdict</h2>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginTop: "1rem",
          marginBottom: "1rem",
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "0.5rem 1rem",
            borderRadius: "9999px",
            background: statusColor(verdict.status),
            color: "white",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          {statusLabel(verdict.status)}
        </span>
        <strong style={{ fontSize: "1.1rem" }}>{verdict.headline}</strong>
      </div>

      {verdict.observations.length > 0 &&
        (expanded ? (
          observationsList
        ) : (
          <details>
            <summary style={{ cursor: "pointer", color: "var(--muted, #6b7280)" }}>
              Show {verdict.observations.length} metrics
            </summary>
            {observationsList}
          </details>
        ))}
    </section>
  );
}
