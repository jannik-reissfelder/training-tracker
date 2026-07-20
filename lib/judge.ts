import { epley1RM } from "@/lib/est1rm";
import { differenceInDaysUTC, formatWeekKey, weeksAgo } from "@/lib/dates";
import type { CoachConfig, SetEntry } from "@/lib/coach/rules";

export type JudgeEntry = SetEntry & { createdAt: Date };

export type ProgressStatus = "progressing" | "stagnating" | "declining" | "insufficient-data";

export interface Observation {
  type: "positive" | "warning" | "negative";
  scope: "exercise" | "muscle" | "global";
  label: string;
  message: string;
  details?: Record<string, number | string>;
}

export interface ProgressVerdict {
  status: ProgressStatus;
  headline: string;
  observations: Observation[];
}

const KG_PER_LB = 0.45359237;

function normalizeToKg(weight: number, unit: string): number {
  if (unit === "lb") return weight * KG_PER_LB;
  return weight;
}

function effectiveRPE(entry: JudgeEntry): number | undefined {
  if (entry.rpe !== null && entry.rpe !== undefined) return entry.rpe;
  if (entry.rir !== null && entry.rir !== undefined) return 10 - entry.rir;
  return undefined;
}

interface ExerciseSessionSummary {
  exerciseName: string;
  bestE1RM: number;
  volumeLoad: number;
  bestSet: { weight: number; reps: number; unit: string; rpe?: number };
}

interface SessionSummary {
  date: Date;
  workoutId: string;
  byExercise: Map<string, ExerciseSessionSummary>;
}

function summarizeSessions(entries: JudgeEntry[]): SessionSummary[] {
  const byWorkout = new Map<string, SessionSummary>();

  for (const e of entries) {
    if (!byWorkout.has(e.workoutId)) {
      byWorkout.set(e.workoutId, {
        date: e.date,
        workoutId: e.workoutId,
        byExercise: new Map(),
      });
    }
    const session = byWorkout.get(e.workoutId)!;
    if (!session.byExercise.has(e.exerciseId)) {
      session.byExercise.set(e.exerciseId, {
        exerciseName: e.exerciseName,
        bestE1RM: 0,
        volumeLoad: 0,
        bestSet: { weight: 0, reps: 0, unit: e.unit, rpe: undefined },
      });
    }
    const ex = session.byExercise.get(e.exerciseId)!;
    const weightKg = normalizeToKg(e.weight, e.unit);
    const e1rm = epley1RM(weightKg, e.reps);
    if (e1rm > ex.bestE1RM) {
      ex.bestE1RM = e1rm;
      ex.bestSet = { weight: e.weight, reps: e.reps, unit: e.unit, rpe: effectiveRPE(e) };
    }
    ex.volumeLoad += weightKg * e.reps;
  }

  return Array.from(byWorkout.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface ExerciseSessionSeries {
  exerciseName: string;
  sessions: {
    date: Date;
    bestE1RM: number;
    volumeLoad: number;
    bestSet: { weight: number; reps: number; unit: string; rpe?: number };
  }[];
}

function sessionsByExercise(sessions: SessionSummary[]): Map<string, ExerciseSessionSeries> {
  const map = new Map<string, ExerciseSessionSeries>();
  for (const session of sessions) {
    for (const [_exerciseId, ex] of session.byExercise) {
      if (!map.has(_exerciseId)) {
        map.set(_exerciseId, { exerciseName: ex.exerciseName, sessions: [] });
      }
      map.get(_exerciseId)!.sessions.push({
        date: session.date,
        bestE1RM: ex.bestE1RM,
        volumeLoad: ex.volumeLoad,
        bestSet: ex.bestSet,
      });
    }
  }
  for (const series of map.values()) {
    series.sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  return map;
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function pctChange(current: number, baseline: number): number {
  if (baseline === 0) return 0;
  return (current - baseline) / baseline;
}

function e1RMObservations(seriesMap: Map<string, ExerciseSessionSeries>, today: Date): Observation[] {
  const obs: Observation[] = [];
  for (const [, series] of seriesMap) {
    const sessions = series.sessions;
    const recentWindow = weeksAgo(4, today);
    const previousWindow = weeksAgo(8, today);

    const recent = sessions.filter((s) => s.date >= recentWindow && s.date <= today);
    const previous = sessions.filter((s) => s.date >= previousWindow && s.date < recentWindow);

    let baselineValues: number[] = [];
    let currentValues: number[] = [];

    if (recent.length >= 2 && previous.length >= 2) {
      baselineValues = previous.slice(-2).map((s) => s.bestE1RM);
      currentValues = recent.slice(-2).map((s) => s.bestE1RM);
    } else if (sessions.length >= 2) {
      baselineValues = sessions.slice(0, 2).map((s) => s.bestE1RM);
      currentValues = sessions.slice(-2).map((s) => s.bestE1RM);
    } else {
      continue;
    }

    const baseAvg = average(baselineValues) ?? 0;
    const currentAvg = average(currentValues) ?? 0;
    const change = pctChange(currentAvg, baseAvg);
    const label = `${series.exerciseName} e1RM`;

    if (change >= 0.03) {
      obs.push({
        type: "positive",
        scope: "exercise",
        label,
        message: `Estimated 1RM is up ${(change * 100).toFixed(1)}% over the comparison window.`,
        details: { baseAvg: Number(baseAvg.toFixed(2)), currentAvg: Number(currentAvg.toFixed(2)) },
      });
    } else if (change <= -0.03) {
      obs.push({
        type: "negative",
        scope: "exercise",
        label,
        message: `Estimated 1RM is down ${(Math.abs(change) * 100).toFixed(1)}% over the comparison window.`,
        details: { baseAvg: Number(baseAvg.toFixed(2)), currentAvg: Number(currentAvg.toFixed(2)) },
      });
    } else {
      obs.push({
        type: "warning",
        scope: "exercise",
        label,
        message: `Estimated 1RM is flat (${(change * 100).toFixed(1)}%) over the comparison window.`,
        details: { baseAvg: Number(baseAvg.toFixed(2)), currentAvg: Number(currentAvg.toFixed(2)) },
      });
    }
  }
  return obs;
}

function rpeDriftObservations(seriesMap: Map<string, ExerciseSessionSeries>, today: Date): Observation[] {
  const obs: Observation[] = [];
  const windowStart = weeksAgo(8, today);

  for (const [, series] of seriesMap) {
    const byKey = new Map<string, { date: Date; rpe: number }[]>();

    for (const s of series.sessions) {
      if (s.date < windowStart || s.date > today) continue;
      const bs = s.bestSet;
      if (bs.rpe === undefined) continue;
      const key = `${bs.weight}${bs.unit}x${bs.reps}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push({ date: s.date, rpe: bs.rpe });
    }

    let latestPair: { date: Date; rpe: number }[] | undefined;
    let latestDate = -Infinity;
    for (const list of byKey.values()) {
      const sorted = list.sort((a, b) => a.date.getTime() - b.date.getTime());
      if (sorted.length >= 2 && sorted[sorted.length - 1].date.getTime() > latestDate) {
        latestPair = sorted;
        latestDate = sorted[sorted.length - 1].date.getTime();
      }
    }
    if (!latestPair) continue;
    const last = latestPair[latestPair.length - 1];
    const prev = latestPair[latestPair.length - 2];
    const diff = last.rpe - prev.rpe;
    const label = `${series.exerciseName} RPE drift`;
    if (diff >= 1) {
      obs.push({
        type: "negative",
        scope: "exercise",
        label,
        message: `At the same load/reps, RPE rose from ${prev.rpe} to ${last.rpe} — the same work is feeling harder.`,
        details: { previousRPE: prev.rpe, currentRPE: last.rpe },
      });
    } else if (diff <= -1) {
      obs.push({
        type: "positive",
        scope: "exercise",
        label,
        message: `At the same load/reps, RPE fell from ${prev.rpe} to ${last.rpe} — the same work is feeling easier.`,
        details: { previousRPE: prev.rpe, currentRPE: last.rpe },
      });
    } else {
      obs.push({
        type: "warning",
        scope: "exercise",
        label,
        message: `RPE is stable at the same load/reps (${last.rpe}). Not enough drift to call a trend.`,
        details: { previousRPE: prev.rpe, currentRPE: last.rpe },
      });
    }
  }
  return obs;
}

function muscleVolumeObservations(entries: JudgeEntry[], config: CoachConfig, today: Date, coldStart: boolean): Observation[] {
  if (coldStart) return [];

  const obs: Observation[] = [];
  const weekSetsByGroup = new Map<string, Map<string, number>>();

  for (const e of entries) {
    const week = formatWeekKey(e.date);
    for (const group of e.muscleGroups) {
      if (!weekSetsByGroup.has(group)) weekSetsByGroup.set(group, new Map());
      const map = weekSetsByGroup.get(group)!;
      map.set(week, (map.get(week) || 0) + 1);
    }
  }

  const lastEntryDate = entries.reduce((max, e) => (e.date > max ? e.date : max), new Date(0));
  const reportDate = lastEntryDate > today ? today : lastEntryDate;
  const lastWeekKey = formatWeekKey(reportDate);
  const baselineStart = formatWeekKey(weeksAgo(config.volumeBaselineWeeks + 1, reportDate));

  for (const [group, groupMap] of weekSetsByGroup) {
    const weeks = Array.from(groupMap.keys()).sort();
    const baselineWeeks = weeks.filter((w) => w <= lastWeekKey && w > baselineStart);
    baselineWeeks.pop(); // remove current/most-recent week
    const lastCompleted = groupMap.get(lastWeekKey) || 0;
    const baselineTotal = baselineWeeks.reduce((sum, w) => sum + (groupMap.get(w) || 0), 0);
    const baselineWeeksWithData = baselineWeeks.filter((w) => (groupMap.get(w) || 0) > 0).length;
    const baselineAvg = baselineWeeks.length > 0 ? baselineTotal / baselineWeeks.length : 0;
    const label = `${group} weekly sets`;

    if (baselineWeeksWithData === 0 && lastCompleted > 0) {
      obs.push({
        type: "positive",
        scope: "muscle",
        label,
        message: `${group} logged ${lastCompleted} hard sets in the first tracked week.`,
        details: { lastCompleted, baselineAverage: 0 },
      });
    } else if (baselineAvg > 0 && lastCompleted < baselineAvg - config.volumeDropThreshold) {
      obs.push({
        type: "negative",
        scope: "muscle",
        label,
        message: `${group} dropped to ${lastCompleted} hard sets this week vs ${baselineAvg.toFixed(1)} recent average.`,
        details: { lastCompleted, baselineAverage: Number(baselineAvg.toFixed(2)) },
      });
    } else if (baselineAvg > 0 && lastCompleted > baselineAvg + config.volumeDropThreshold) {
      obs.push({
        type: "positive",
        scope: "muscle",
        label,
        message: `${group} rose to ${lastCompleted} hard sets this week vs ${baselineAvg.toFixed(1)} recent average.`,
        details: { lastCompleted, baselineAverage: Number(baselineAvg.toFixed(2)) },
      });
    } else if (lastCompleted < 4) {
      obs.push({
        type: "warning",
        scope: "muscle",
        label,
        message: `${group} is at ${lastCompleted} hard sets this week — below the 4-set minimum-effective-dose range.`,
        details: { lastCompleted, baselineAverage: Number(baselineAvg.toFixed(2)) },
      });
    } else {
      obs.push({
        type: "positive",
        scope: "muscle",
        label,
        message: `${group} is at ${lastCompleted} hard sets this week, within the efficient 4-10 set range.`,
        details: { lastCompleted, baselineAverage: Number(baselineAvg.toFixed(2)) },
      });
    }
  }
  return obs;
}

function adherenceObservations(sessions: SessionSummary[], config: CoachConfig, today: Date): Observation[] {
  const obs: Observation[] = [];
  if (sessions.length === 0) return obs;
  const firstDate = sessions[0].date;
  const daysSinceFirst = Math.max(1, differenceInDaysUTC(today, firstDate));
  const windowWeeks = config.consistencyWindowWeeks;
  const elapsedWeeks = daysSinceFirst / 7;
  const effectiveWeeks = Math.min(windowWeeks, elapsedWeeks);
  const target = Math.max(1, Math.ceil(config.frequencyMin * effectiveWeeks));

  const windowStart = weeksAgo(windowWeeks, today);
  const recent = sessions.filter((s) => s.date >= windowStart && s.date <= today);
  const actual = recent.length;
  const pct = target > 0 ? actual / target : 0;
  const label = "Session adherence";

  if (pct >= 0.85) {
    obs.push({
      type: "positive",
      scope: "global",
      label,
      message: `${actual} sessions in the last ${windowWeeks} weeks (${(pct * 100).toFixed(0)}% of ${target} target).`,
      details: { actual, target, pct: Number(pct.toFixed(2)) },
    });
  } else if (pct >= 0.7) {
    obs.push({
      type: "warning",
      scope: "global",
      label,
      message: `${actual} sessions in the last ${windowWeeks} weeks (${(pct * 100).toFixed(0)}% of ${target} target) — below the 85% threshold, making progress hard to interpret.`,
      details: { actual, target, pct: Number(pct.toFixed(2)) },
    });
  } else {
    obs.push({
      type: "negative",
      scope: "global",
      label,
      message: `${actual} sessions in the last ${windowWeeks} weeks (${(pct * 100).toFixed(0)}% of ${target} target) — frequency is too low for progress.`,
      details: { actual, target, pct: Number(pct.toFixed(2)) },
    });
  }
  return obs;
}

function volumeLoadObservations(seriesMap: Map<string, ExerciseSessionSeries>, today: Date): Observation[] {
  const obs: Observation[] = [];
  const windowStart = weeksAgo(4, today);

  for (const [, series] of seriesMap) {
    const recent = series.sessions.filter((s) => s.date >= windowStart && s.date <= today);
    if (recent.length < 2) continue;

    const last = recent[recent.length - 1].volumeLoad;
    const previousValues = recent.slice(0, -1).map((s) => s.volumeLoad);
    const previousAvg = average(previousValues) ?? 0;
    if (previousAvg === 0) continue;

    const change = pctChange(last, previousAvg);
    const label = `${series.exerciseName} volume load`;

    if (change >= 0.02) {
      obs.push({
        type: "positive",
        scope: "exercise",
        label,
        message: `Volume load is up ${(change * 100).toFixed(1)}% vs recent average.`,
        details: { currentVolume: Number(last.toFixed(2)), previousAverage: Number(previousAvg.toFixed(2)) },
      });
    } else if (change <= -0.05) {
      obs.push({
        type: "negative",
        scope: "exercise",
        label,
        message: `Volume load is down ${(Math.abs(change) * 100).toFixed(1)}% vs recent average.`,
        details: { currentVolume: Number(last.toFixed(2)), previousAverage: Number(previousAvg.toFixed(2)) },
      });
    } else {
      obs.push({
        type: "warning",
        scope: "exercise",
        label,
        message: `Volume load is stable (${(change * 100).toFixed(1)}%) vs recent average.`,
        details: { currentVolume: Number(last.toFixed(2)), previousAverage: Number(previousAvg.toFixed(2)) },
      });
    }
  }
  return obs;
}

function setDropoffObservations(entries: JudgeEntry[], today: Date): Observation[] {
  const obs: Observation[] = [];
  const windowStart = weeksAgo(4, today);
  const byExercise = new Map<string, { exerciseName: string; byWorkout: Map<string, { date: Date; dropoff: number }> }>();

  const byWorkout = new Map<string, { date: Date; byExercise: Map<string, JudgeEntry[]> }>();
  for (const e of entries) {
    if (e.date < windowStart || e.date > today) continue;
    if (!byWorkout.has(e.workoutId)) {
      byWorkout.set(e.workoutId, { date: e.date, byExercise: new Map() });
    }
    const w = byWorkout.get(e.workoutId)!;
    if (!w.byExercise.has(e.exerciseId)) w.byExercise.set(e.exerciseId, []);
    w.byExercise.get(e.exerciseId)!.push(e);
  }

  for (const [workoutId, w] of byWorkout) {
    for (const [exerciseId, sets] of w.byExercise) {
      const sorted = sets.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      if (sorted.length < 2) continue;
      const first = sorted[0];
      const second = sorted.find((s) => s.weight === first.weight && s.unit === first.unit && s.createdAt.getTime() > first.createdAt.getTime());
      if (!second || first.reps === 0) continue;
      const dropoff = (first.reps - second.reps) / first.reps;
      if (!byExercise.has(exerciseId)) byExercise.set(exerciseId, { exerciseName: first.exerciseName, byWorkout: new Map() });
      byExercise.get(exerciseId)!.byWorkout.set(workoutId, { date: w.date, dropoff });
    }
  }

  for (const [, ex] of byExercise) {
    const list = Array.from(ex.byWorkout.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (list.length === 0) continue;
    const last = list[list.length - 1];
    const label = `${ex.exerciseName} rep drop-off`;

    if (list.length >= 2) {
      const lastTwo = list.slice(-2);
      const avgDrop = lastTwo.reduce((s, x) => s + x.dropoff, 0) / lastTwo.length;
      if (avgDrop > 0.2) {
        obs.push({
          type: "negative",
          scope: "exercise",
          label,
          message: `Rep drop-off is ${(avgDrop * 100).toFixed(0)}% over the last two sessions (>20% — first set likely too hard or recovery too short).`,
          details: { dropOff: Number(avgDrop.toFixed(2)) },
        });
      } else if (avgDrop <= 0.15) {
        obs.push({
          type: "positive",
          scope: "exercise",
          label,
          message: `Rep drop-off is ${(avgDrop * 100).toFixed(0)}% over the last two sessions (within the 10-15% quality range).`,
          details: { dropOff: Number(avgDrop.toFixed(2)) },
        });
      } else {
        obs.push({
          type: "warning",
          scope: "exercise",
          label,
          message: `Rep drop-off is ${(avgDrop * 100).toFixed(0)}% over the last two sessions (watch it).`,
          details: { dropOff: Number(avgDrop.toFixed(2)) },
        });
      }
    } else {
      if (last.dropoff > 0.2) {
        obs.push({
          type: "warning",
          scope: "exercise",
          label,
          message: `Rep drop-off is ${(last.dropoff * 100).toFixed(0)}% in the last session (>20% — check first-set effort or recovery).`,
          details: { dropOff: Number(last.dropoff.toFixed(2)) },
        });
      } else {
        obs.push({
          type: "positive",
          scope: "exercise",
          label,
          message: `Rep drop-off is ${(last.dropoff * 100).toFixed(0)}% in the last session (within the quality range).`,
          details: { dropOff: Number(last.dropoff.toFixed(2)) },
        });
      }
    }
  }
  return obs;
}

function determineStatus(observations: Observation[]): ProgressStatus {
  if (observations.length === 0) return "insufficient-data";
  if (observations.some((o) => o.type === "negative")) return "declining";
  if (observations.some((o) => o.type === "warning")) return "stagnating";
  if (observations.some((o) => o.type === "positive")) return "progressing";
  return "insufficient-data";
}

function buildHeadline(status: ProgressStatus, observations: Observation[]): string {
  if (observations.length === 0) {
    return "Not enough data yet — keep logging consistent sessions.";
  }
  const first = observations[0];
  switch (status) {
    case "progressing":
      return `Progress is on track: ${first.message}`;
    case "stagnating":
      return `Progress is stalling: ${first.message}`;
    case "declining":
      return `Progress is declining: ${first.message}`;
    case "insufficient-data":
      return `Cannot judge progress: ${first.message}`;
  }
}

function isColdStart(sessions: SessionSummary[], today: Date): boolean {
  if (sessions.length === 0) return false;
  const daysSinceFirst = (today.getTime() - sessions[0].date.getTime()) / (1000 * 60 * 60 * 24);
  return sessions.length < 2 || (sessions.length < 3 && daysSinceFirst < 7);
}

export function judgeProgress(entries: JudgeEntry[], config: CoachConfig, today = new Date()): ProgressVerdict {
  const sessions = summarizeSessions(entries);
  const seriesMap = sessionsByExercise(sessions);
  const coldStart = isColdStart(sessions, today);

  const observations: Observation[] = [];
  observations.push(...adherenceObservations(sessions, config, today));
  observations.push(...e1RMObservations(seriesMap, today));
  observations.push(...rpeDriftObservations(seriesMap, today));
  observations.push(...muscleVolumeObservations(entries, config, today, coldStart));
  observations.push(...volumeLoadObservations(seriesMap, today));
  observations.push(...setDropoffObservations(entries, today));

  let status = determineStatus(observations);
  let headline = buildHeadline(status, observations);

  if (coldStart) {
    status = "insufficient-data";
    headline = "Baseline set — log a few more sessions over the next 1-2 weeks to get your first progress verdict.";
  }

  return { status, headline, observations };
}
