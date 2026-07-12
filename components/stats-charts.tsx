"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { epley1RM } from "@/lib/est1rm";
import { formatWeekKey, weeksAgo } from "@/lib/dates";

export interface StatsWorkout {
  id: string;
  date: string;
  setEntries: {
    id: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroups: string[];
    reps: number;
    weight: number;
    unit: string;
  }[];
}

export default function StatsCharts({
  workouts,
  exercises,
}: {
  workouts: StatsWorkout[];
  exercises: { id: string; name: string }[];
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>("");

  const exerciseOptions = useMemo(
    () =>
      exercises
        .filter((ex) => workouts.some((w) => w.setEntries.some((s) => s.exerciseId === ex.id)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [exercises, workouts]
  );

  const muscleGroups = useMemo(() => {
    const set = new Set<string>();
    for (const w of workouts) {
      for (const s of w.setEntries) {
        for (const g of s.muscleGroups) set.add(g);
      }
    }
    return Array.from(set).sort();
  }, [workouts]);

  const exerciseSeries = useMemo(() => {
    if (!selectedExerciseId) return [];

    const byWorkout = new Map<string, { date: string; sets: typeof workouts[0]["setEntries"] }>();
    for (const w of workouts) {
      const sets = w.setEntries.filter((s) => s.exerciseId === selectedExerciseId);
      if (sets.length > 0) {
        byWorkout.set(w.id, { date: w.date, sets });
      }
    }

    return Array.from(byWorkout.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((entry) => {
        const best = entry.sets.reduce((acc, s) => {
          const est = epley1RM(s.weight, s.reps);
          if (est > acc.est1RM) {
            return { weight: s.weight, reps: s.reps, est1RM: est, volume: 0 };
          }
          return acc;
        }, { weight: 0, reps: 0, est1RM: 0, volume: 0 });

        const totalVolume = entry.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

        return {
          date: new Date(entry.date).toLocaleDateString(),
          weight: best.weight,
          reps: best.reps,
          est1RM: Number(best.est1RM.toFixed(2)),
          totalVolume: Number(totalVolume.toFixed(2)),
          sets: entry.sets.length,
        };
      });
  }, [workouts, selectedExerciseId]);

  const muscleGroupSeries = useMemo(() => {
    const weeks = new Map<string, number>();
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const week = formatWeekKey(weeksAgo(i, today));
      weeks.set(week, 0);
    }

    for (const w of workouts) {
      for (const s of w.setEntries) {
        if (!selectedMuscleGroup || s.muscleGroups.includes(selectedMuscleGroup)) {
          const week = formatWeekKey(new Date(w.date));
          if (weeks.has(week)) {
            weeks.set(week, (weeks.get(week) || 0) + 1);
          }
        }
      }
    }

    return Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, sets]) => ({ week: week.slice(5), sets }));
  }, [workouts, selectedMuscleGroup]);

  const consistencySeries = useMemo(() => {
    const weeks = new Map<string, number>();
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const week = formatWeekKey(weeksAgo(i, today));
      weeks.set(week, 0);
    }

    for (const w of workouts) {
      const week = formatWeekKey(new Date(w.date));
      if (weeks.has(week)) {
        weeks.set(week, (weeks.get(week) || 0) + 1);
      }
    }

    return Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, sessions]) => ({ week: week.slice(5), sessions }));
  }, [workouts]);

  const bestSet = useMemo(() => {
    if (!selectedExerciseId) return null;
    let best = { weight: 0, reps: 0, est1RM: 0, date: "" };
    for (const w of workouts) {
      for (const s of w.setEntries) {
        if (s.exerciseId !== selectedExerciseId) continue;
        const est = epley1RM(s.weight, s.reps);
        if (est > best.est1RM) {
          best = { weight: s.weight, reps: s.reps, est1RM: est, date: w.date };
        }
      }
    }
    return best.est1RM > 0 ? best : null;
  }, [workouts, selectedExerciseId]);

  return (
    <div className="stack">
      <section className="card">
        <h2>Per-exercise progress</h2>
        <label htmlFor="exercise">Exercise</label>
        <select
          id="exercise"
          value={selectedExerciseId}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
        >
          <option value="">Select exercise</option>
          {exerciseOptions.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>

        {selectedExerciseId && exerciseSeries.length === 0 && <p className="muted">No data for this exercise.</p>}

        {selectedExerciseId && exerciseSeries.length > 0 && (
          <>
            <div className="row" style={{ marginTop: "1rem" }}>
              {bestSet && (
                <div className="card">
                  <strong>Best set</strong>
                  <p className="muted">
                    {bestSet.weight} × {bestSet.reps} (est 1RM {bestSet.est1RM.toFixed(1)}) on {new Date(bestSet.date).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div className="card">
                <strong>Sessions</strong>
                <p className="muted">{exerciseSeries.length}</p>
              </div>
            </div>

            <div style={{ width: "100%", height: 300, marginTop: "1rem" }}>
              <LineChart width={800} height={300} data={exerciseSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="weight" stroke="#2563eb" name="Best weight" />
                <Line yAxisId="left" type="monotone" dataKey="est1RM" stroke="#16a34a" name="Est 1RM" />
                <Line yAxisId="right" type="monotone" dataKey="reps" stroke="#dc2626" name="Best reps" />
              </LineChart>
            </div>

            <table style={{ marginTop: "1rem" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Best weight</th>
                  <th>Best reps</th>
                  <th>Est 1RM</th>
                  <th>Total volume</th>
                  <th>Sets</th>
                </tr>
              </thead>
              <tbody>
                {exerciseSeries.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.date}</td>
                    <td>{row.weight}</td>
                    <td>{row.reps}</td>
                    <td>{row.est1RM}</td>
                    <td>{row.totalVolume}</td>
                    <td>{row.sets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="card">
        <h2>Per-muscle-group weekly volume</h2>
        <label htmlFor="muscleGroup">Muscle group</label>
        <select
          id="muscleGroup"
          value={selectedMuscleGroup}
          onChange={(e) => setSelectedMuscleGroup(e.target.value)}
        >
          <option value="">All groups</option>
          {muscleGroups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <div style={{ width: "100%", height: 300, marginTop: "1rem" }}>
          <LineChart width={800} height={300} data={muscleGroupSeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="sets" stroke="#2563eb" name="Working sets" />
          </LineChart>
        </div>
      </section>

      <section className="card">
        <h2>Consistency (sessions per week)</h2>
        <div style={{ width: "100%", height: 300 }}>
          <BarChart width={800} height={300} data={consistencySeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="sessions" fill="#2563eb" name="Sessions" />
          </BarChart>
        </div>
      </section>
    </div>
  );
}
