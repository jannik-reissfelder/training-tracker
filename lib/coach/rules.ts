import { epley1RM } from "@/lib/est1rm";
import { weeksAgo, formatWeekKey } from "@/lib/dates";

export type SignalType =
  | "positive-trend"
  | "stagnation"
  | "volume-drop"
  | "consistency-drop";

export interface Signal {
  type: SignalType;
  exerciseId?: string;
  exerciseName?: string;
  muscleGroup?: string;
  message: string;
  details: Record<string, number | string>;
}

export interface SetEntry {
  date: Date;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroups: string[];
  reps: number;
  weight: number;
  unit: string;
  rir?: number;
  rpe?: number;
}

export interface CoachConfig {
  splitType: string;
  frequencyMin: number;
  frequencyMax: number;
  primaryGoal: string;
  targetSetsPerExercise: number;
  stagnationWindowWeeks: number;
  volumeBaselineWeeks: number;
  volumeDropThreshold: number;
  consistencyWindowWeeks: number;
}

const FLAT_THRESHOLD = 0.001;
const TREND_WINDOW = 2;

export function analyze(entries: SetEntry[], config: CoachConfig, today = new Date()): Signal[] {
  const signals: Signal[] = [];
  signals.push(...analyzePositiveTrend(entries));
  signals.push(...analyzeStagnation(entries, config, today));
  signals.push(...analyzeVolumeDrop(entries, config, today));
  signals.push(...analyzeConsistencyDrop(entries, config, today));
  return signals;
}

function bestSet1RM(sets: SetEntry[]): number {
  let best = 0;
  for (const s of sets) {
    const est = epley1RM(s.weight, s.reps);
    if (est > best) best = est;
  }
  return best;
}

function sessionsByExercise(entries: SetEntry[]) {
  const map = new Map<string, { date: Date; best1RM: number }[]>();
  const byWorkout = new Map<string, { date: Date; sets: SetEntry[] }>();

  for (const e of entries) {
    const key = `${e.exerciseId}__${e.workoutId}`;
    if (!byWorkout.has(key)) {
      byWorkout.set(key, { date: e.date, sets: [] });
    }
    byWorkout.get(key)!.sets.push(e);
  }

  for (const [, { date, sets }] of byWorkout) {
    const best = bestSet1RM(sets);
    const exerciseId = sets[0].exerciseId;
    if (!map.has(exerciseId)) {
      map.set(exerciseId, []);
    }
    map.get(exerciseId)!.push({ date, best1RM: best });
  }

  for (const arr of map.values()) {
    arr.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return map;
}

function analyzePositiveTrend(entries: SetEntry[]): Signal[] {
  const signals: Signal[] = [];
  const byExercise = sessionsByExercise(entries);

  for (const [exerciseId, sessions] of byExercise) {
    const exerciseName = entries.find((e) => e.exerciseId === exerciseId)?.exerciseName;
    if (sessions.length < TREND_WINDOW * 2) continue;

    const recent = sessions.slice(-TREND_WINDOW);
    const previous = sessions.slice(-TREND_WINDOW * 2, -TREND_WINDOW);
    const recentAvg = recent.reduce((sum, s) => sum + s.best1RM, 0) / recent.length;
    const previousAvg = previous.reduce((sum, s) => sum + s.best1RM, 0) / previous.length;

    if (recentAvg > previousAvg + FLAT_THRESHOLD) {
      signals.push({
        type: "positive-trend",
        exerciseId,
        exerciseName: entries.find((e) => e.exerciseId === exerciseId)?.exerciseName,
        message: `Trending up on ${exerciseName || exerciseId}`,
        details: {
          recentAverage: Number(recentAvg.toFixed(2)),
          previousAverage: Number(previousAvg.toFixed(2)),
          sessions: sessions.length,
          recentSessions: recent.length,
        },
      });
    }
  }

  return signals;
}

function analyzeStagnation(entries: SetEntry[], config: CoachConfig, today: Date): Signal[] {
  const signals: Signal[] = [];
  const byExercise = sessionsByExercise(entries);
  const windowStart = weeksAgo(config.stagnationWindowWeeks, today);

  for (const [exerciseId, sessions] of byExercise) {
    const inWindow = sessions.filter((s) => s.date >= windowStart && s.date <= today);
    if (inWindow.length < config.stagnationWindowWeeks) continue;

    const values = inWindow.map((s) => s.best1RM);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max - min <= FLAT_THRESHOLD) {
      const exerciseName = entries.find((e) => e.exerciseId === exerciseId)?.exerciseName;
      signals.push({
        type: "stagnation",
        exerciseId,
        exerciseName,
        message: `Stagnation on ${exerciseName || exerciseId} over the last ${config.stagnationWindowWeeks} weeks`,
        details: {
          min1RM: Number(min.toFixed(2)),
          max1RM: Number(max.toFixed(2)),
          sessions: inWindow.length,
          windowWeeks: config.stagnationWindowWeeks,
        },
      });
    }
  }

  return signals;
}

function analyzeVolumeDrop(entries: SetEntry[], config: CoachConfig, today: Date): Signal[] {
  const signals: Signal[] = [];
  const weekSetsByGroup = new Map<string, Map<string, number>>();

  for (const e of entries) {
    const week = formatWeekKey(e.date);
    for (const group of e.muscleGroups) {
      if (!weekSetsByGroup.has(group)) {
        weekSetsByGroup.set(group, new Map<string, number>());
      }
      const groupMap = weekSetsByGroup.get(group)!;
      groupMap.set(week, (groupMap.get(week) || 0) + 1);
    }
  }

  const lastEntryDate = entries.reduce((max, e) => (e.date > max ? e.date : max), new Date(0));
  const reportDate = lastEntryDate > today ? today : lastEntryDate;
  const baselineEndWeek = formatWeekKey(reportDate);

  for (const [group, groupMap] of weekSetsByGroup) {
    const weeks = Array.from(groupMap.keys()).sort();
    const baselineWeeks = weeks.filter(
      (w) => w <= baselineEndWeek && w > formatWeekKey(weeksAgo(config.volumeBaselineWeeks + 1, reportDate))
    );
    baselineWeeks.pop(); // exclude the most recent week from the baseline
    if (baselineWeeks.length === 0) continue;

    const baselineTotal = baselineWeeks.reduce((sum, w) => sum + (groupMap.get(w) || 0), 0);
    const baselineAvg = baselineTotal / baselineWeeks.length;
    const lastCompleted = groupMap.get(baselineEndWeek) || 0;

    if (baselineAvg - lastCompleted > config.volumeDropThreshold) {
      signals.push({
        type: "volume-drop",
        muscleGroup: group,
        message: `Volume drop for ${group}: ${lastCompleted} sets last week vs ${baselineAvg.toFixed(1)} avg baseline`,
        details: {
          muscleGroup: group,
          lastCompleted,
          baselineAverage: Number(baselineAvg.toFixed(2)),
          baselineWeeks: baselineWeeks.length,
        },
      });
    }
  }

  return signals;
}

function analyzeConsistencyDrop(entries: SetEntry[], config: CoachConfig, today: Date): Signal[] {
  const signals: Signal[] = [];

  if (entries.length === 0) return signals;
  const firstDate = entries.reduce((min, e) => (e.date < min ? e.date : min), today);
  const daysSinceFirst = Math.max(1, (today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceFirst < 2) return signals;

  const windowStart = weeksAgo(config.consistencyWindowWeeks, today);
  const sessions = new Set<string>();

  for (const e of entries) {
    if (e.date >= windowStart && e.date <= today) {
      sessions.add(e.workoutId);
    }
  }

  const count = sessions.size;
  const elapsedWeeks = daysSinceFirst / 7;
  const effectiveWeeks = Math.min(config.consistencyWindowWeeks, elapsedWeeks);
  const target = Math.max(1, Math.ceil(config.frequencyMin * effectiveWeeks));

  if (count < target) {
    signals.push({
      type: "consistency-drop",
      message: `Consistency drop: ${count} sessions in the last ${config.consistencyWindowWeeks} weeks (target ${target})`,
      details: {
        sessions: count,
        target,
        windowWeeks: config.consistencyWindowWeeks,
      },
    });
  }

  return signals;
}
