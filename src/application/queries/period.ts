import type { ID, ISODate } from '@domain/entities';

export type PeriodDays = 7 | 14 | 30;
export const PERIOD_OPTIONS: PeriodDays[] = [7, 14, 30];

/** Global filter shared by KPIs, scene and panels. */
export interface ScopeFilter {
  periodDays: PeriodDays;
  squadId: ID | null;
  now: Date;
}

const DAY_MS = 86_400_000;

export function periodStart(f: ScopeFilter): number {
  return f.now.getTime() - f.periodDays * DAY_MS;
}

export function inPeriod(f: ScopeFilter, at: ISODate | null | undefined): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  return t >= periodStart(f) && t <= f.now.getTime();
}

export function withinHours(now: Date, at: ISODate | null | undefined, hours: number): boolean {
  if (!at) return false;
  const diff = now.getTime() - Date.parse(at);
  return diff >= 0 && diff <= hours * 3_600_000;
}

export function inSquad(f: ScopeFilter, squadId: ID): boolean {
  return f.squadId === null || f.squadId === squadId;
}

export function latest(dates: (ISODate | null | undefined)[]): ISODate | null {
  let best: ISODate | null = null;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
}
