export function startOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function startOfWeekUTC(date: Date, startDay = 1): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day < startDay ? day + 7 : day) - startDay;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function differenceInDaysUTC(a: Date, b: Date): number {
  const ms = startOfDayUTC(a).getTime() - startOfDayUTC(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function differenceInWeeksUTC(a: Date, b: Date): number {
  return Math.floor(differenceInDaysUTC(a, b) / 7);
}

export function formatWeekKey(date: Date): string {
  return startOfWeekUTC(date).toISOString().slice(0, 10);
}

export function weeksAgo(weeks: number, from: Date = new Date()): Date {
  return addDaysUTC(from, -weeks * 7);
}
