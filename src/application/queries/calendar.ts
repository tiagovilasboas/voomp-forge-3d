import type { ForgeIndex } from './forgeIndex';
import { listEvents, type DeliveryEvent, type DeliveryEventKind } from './events';
import type { ScopeFilter } from './period';

export interface CalendarDay {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  events: DeliveryEvent[];
  counts: Record<DeliveryEventKind, number>;
}

const EMPTY_COUNTS = (): Record<DeliveryEventKind, number> => ({
  merged: 0,
  pipeline_failed: 0,
  deployed_staging: 0,
  deployed_production: 0,
});

/** YYYY-MM-DD in the given IANA time zone (defaults to the runtime's). */
export function dayKey(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/**
 * Evidence grouped by calendar day, oldest first, one entry per day of the
 * scope's period (empty days included so the grid has no gaps).
 */
export function deliveryCalendar(idx: ForgeIndex, scope: ScopeFilter, timeZone?: string): CalendarDay[] {
  const byDay = new Map<string, CalendarDay>();
  for (let i = scope.periodDays - 1; i >= 0; i--) {
    const date = dayKey(new Date(scope.now.getTime() - i * 86_400_000).toISOString(), timeZone);
    byDay.set(date, { date, events: [], counts: EMPTY_COUNTS() });
  }
  for (const event of listEvents(idx, scope)) {
    const day = byDay.get(dayKey(event.at, timeZone));
    if (!day) continue;
    day.events.push(event);
    day.counts[event.kind]++;
  }
  for (const day of byDay.values()) day.events.sort((a, b) => a.at.localeCompare(b.at));
  return [...byDay.values()];
}
