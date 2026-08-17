"use client";

import { updateConfig } from "@/app/actions";

interface Config {
  splitType?: string | null;
  primaryGoal?: string | null;
  frequencyMin?: number | null;
  frequencyMax?: number | null;
  targetSetsPerExercise?: number | null;
  stagnationWindowWeeks?: number | null;
  volumeBaselineWeeks?: number | null;
  volumeDropThreshold?: number | null;
  consistencyWindowWeeks?: number | null;
}

export default function SettingsForm({ config }: { config: Config | null }) {
  return (
    <form action={updateConfig} className="card stack">
      <label htmlFor="splitType">Split type</label>
      <input id="splitType" name="splitType" defaultValue={config?.splitType ?? "full body"} required />

      <label htmlFor="primaryGoal">Primary goal</label>
      <input id="primaryGoal" name="primaryGoal" defaultValue={config?.primaryGoal ?? "hypertrophy + functional fitness"} required />

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))" }}>
        <div>
          <label>Frequency min</label>
          <input name="frequencyMin" type="number" min={1} defaultValue={config?.frequencyMin ?? 2} required />
        </div>
        <div>
          <label>Frequency max</label>
          <input name="frequencyMax" type="number" min={1} defaultValue={config?.frequencyMax ?? 3} required />
        </div>
        <div>
          <label>Target sets / exercise</label>
          <input name="targetSetsPerExercise" type="number" min={1} defaultValue={config?.targetSetsPerExercise ?? 2} required />
        </div>
        <div>
          <label>Stagnation window (weeks)</label>
          <input name="stagnationWindowWeeks" type="number" min={1} defaultValue={config?.stagnationWindowWeeks ?? 4} required />
        </div>
        <div>
          <label>Volume baseline (weeks)</label>
          <input name="volumeBaselineWeeks" type="number" min={1} defaultValue={config?.volumeBaselineWeeks ?? 4} required />
        </div>
        <div>
          <label>Volume drop threshold</label>
          <input name="volumeDropThreshold" type="number" min={0} defaultValue={config?.volumeDropThreshold ?? 2} required />
        </div>
        <div>
          <label>Consistency window (weeks)</label>
          <input name="consistencyWindowWeeks" type="number" min={1} defaultValue={config?.consistencyWindowWeeks ?? 2} required />
        </div>
      </div>

      <button type="submit" className="btn primary">Save settings</button>
    </form>
  );
}
