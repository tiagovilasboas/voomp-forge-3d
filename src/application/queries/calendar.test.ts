import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '@infrastructure/demo/demoSnapshot';
import { buildIndex } from './forgeIndex';
import { deliveryCalendar } from './calendar';
import { listEvents } from './events';

const now = new Date('2026-10-09T12:00:00Z');
const idx = buildIndex(buildDemoSnapshot(now));
const scope = { periodDays: 14 as const, squadId: null, now };

describe('deliveryCalendar', () => {
  const days = deliveryCalendar(idx, scope, 'UTC');

  it('has one entry per day of the period, oldest first, without gaps', () => {
    expect(days).toHaveLength(14);
    expect(days[days.length - 1].date).toBe('2026-10-09');
    expect([...days].map((d) => d.date).sort()).toEqual(days.map((d) => d.date));
  });

  it('places every event of the period on exactly one day', () => {
    const total = days.reduce((n, d) => n + d.events.length, 0);
    expect(total).toBe(listEvents(idx, scope).length);
    for (const d of days) {
      expect(Object.values(d.counts).reduce((a, b) => a + b, 0)).toBe(d.events.length);
    }
  });

  it('respects the squad filter', () => {
    const admin = deliveryCalendar(idx, { ...scope, squadId: 'sq-admin' }, 'UTC');
    for (const d of admin) for (const e of d.events) expect(e.squadId).toBe('sq-admin');
  });
});
