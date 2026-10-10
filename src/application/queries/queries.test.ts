import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '@infrastructure/demo/demoSnapshot';
import { buildIndex } from './forgeIndex';
import { computeKpis, type Kpis } from './kpis';
import { listDeliveries, STATUS_GROUP } from './deliveries';
import { repositoryHealth } from './repositoryHealth';
import { initiativeSummary } from './initiatives';
import { personSummary } from './summaries';
import type { PeriodDays, ScopeFilter } from './period';

const now = new Date('2026-10-09T12:00:00Z');
const idx = buildIndex(buildDemoSnapshot(now));
const scope = (periodDays: PeriodDays = 30, squadId: string | null = null): ScopeFilter => ({ periodDays, squadId, now });

describe('computeKpis', () => {
  const fields: Array<keyof Kpis> = ['merged', 'awaitingReview', 'pipelineFailures', 'productionDeploys', 'initiativeDeliveries'];

  it.each(fields)('per-squad %s sums to the all-squads value', (field) => {
    const total = computeKpis(idx, scope())[field];
    const sum = idx.snapshot.squads.reduce((acc, sq) => acc + computeKpis(idx, scope(30, sq.id))[field], 0);
    expect(sum).toBe(total);
  });

  it('is not trivially empty over 30 days', () => {
    const k = computeKpis(idx, scope());
    expect(k.merged).toBeGreaterThan(0);
    expect(k.productionDeploys).toBeGreaterThan(0);
  });

  it('grows monotonically with the period', () => {
    const [k7, k14, k30] = ([7, 14, 30] as const).map((d) => computeKpis(idx, scope(d)));
    expect(k7.merged).toBeLessThanOrEqual(k14.merged);
    expect(k14.merged).toBeLessThanOrEqual(k30.merged);
    expect(k7.productionDeploys).toBeLessThanOrEqual(k14.productionDeploys);
    expect(k14.productionDeploys).toBeLessThanOrEqual(k30.productionDeploys);
  });
});

describe('listDeliveries', () => {
  it('filters by status group', () => {
    const list = listDeliveries(idx, scope(), { status: 'blocked' });
    expect(list.length).toBeGreaterThan(0);
    for (const d of list) expect(STATUS_GROUP[d.status]).toBe('blocked');
  });

  it("initiativeId 'none' returns only deliveries without an initiative", () => {
    const list = listDeliveries(idx, scope(), { initiativeId: 'none' });
    expect(list.length).toBeGreaterThan(0);
    for (const d of list) expect(d.initiative).toBeNull();
  });

  it('filters by a specific initiative', () => {
    const list = listDeliveries(idx, scope(), { initiativeId: 'ini-unified-ci' });
    expect(list.length).toBeGreaterThan(0);
    for (const d of list) expect(d.initiative?.id).toBe('ini-unified-ci');
  });

  it("environment 'production' returns only deliveries that reached production", () => {
    const list = listDeliveries(idx, scope(), { environment: 'production' });
    expect(list.length).toBeGreaterThan(0);
    for (const d of list) expect(d.environments).toContain('production');
  });

  it('filters by repository', () => {
    const list = listDeliveries(idx, scope(), { repoId: 'repo-design-system' });
    expect(list.length).toBeGreaterThan(0);
    for (const d of list) expect(d.repo.id).toBe('repo-design-system');
  });

  it('filters by squad scope', () => {
    const list = listDeliveries(idx, scope(30, 'sq-enable'));
    expect(list.length).toBeGreaterThan(0);
    for (const d of list) expect(d.squad.id).toBe('sq-enable');
  });

  it('searches text case-insensitively over title, repo and number', () => {
    const byTitle = listDeliveries(idx, scope(), { text: 'CIRCUIT BREAKER' });
    expect(byTitle.map((d) => d.cr.number)).toEqual([312]);
    const byNumber = listDeliveries(idx, scope(), { text: '#312' });
    expect(byNumber.map((d) => d.cr.id)).toContain('cr-incident-gateway-312');
    expect(listDeliveries(idx, scope(), { text: 'zzz-no-match' })).toEqual([]);
  });

  it('is sorted by last activity, newest first', () => {
    const dates = listDeliveries(idx, scope()).map((d) => d.lastActivityAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe('repositoryHealth', () => {
  it('legacy checkout is idle with unknown pipeline', () => {
    const h = repositoryHealth(idx, 'repo-legacy-checkout', scope());
    expect(h.idle).toBe(true);
    expect(h.hot).toBe(false);
    expect(h.pipeline.signal).toBe('unknown');
    expect(h.alert).toBe(false);
  });

  it('a repository with a failing latest run raises an alert', () => {
    const h = repositoryHealth(idx, 'repo-admin-console-web', scope());
    expect(h.pipeline.signal).toBe('error');
    expect(h.alert).toBe(true);
  });

  it('a repository with a blocked change raises an alert', () => {
    const h = repositoryHealth(idx, 'repo-admin-permissions-svc', scope());
    expect(h.blockedChanges).toBeGreaterThan(0);
    expect(h.alert).toBe(true);
  });

  it('a repository with a failed production deployment raises an alert', () => {
    expect(repositoryHealth(idx, 'repo-incident-gateway', scope()).alert).toBe(true);
  });

  it('a healthy repository has no alert', () => {
    const h = repositoryHealth(idx, 'repo-platform-observability', scope());
    expect(h.alert).toBe(false);
    expect(h.idle).toBe(false);
  });
});

describe('initiativeSummary', () => {
  it('has a non-empty headline', () => {
    for (const i of idx.snapshot.initiatives) {
      expect(initiativeSummary(idx, i.id, scope()).headline.length).toBeGreaterThan(0);
    }
  });

  it('team permissions spans two squads', () => {
    const { repositories } = initiativeSummary(idx, 'ini-team-permissions', scope());
    expect(new Set(repositories.map((r) => r.squadId)).size).toBe(2);
  });

  it('ignores the squad filter', () => {
    const all = initiativeSummary(idx, 'ini-team-permissions', scope());
    const filtered = initiativeSummary(idx, 'ini-team-permissions', scope(30, 'sq-n3'));
    expect(filtered.deliveries.length).toBe(all.deliveries.length);
  });
});

describe('personSummary', () => {
  it('exposes only participation data, never a numeric score', () => {
    const s = personSummary(idx, 'ct-zelia-k', scope());
    expect(Object.keys(s).sort()).toEqual(['authored', 'person', 'productionParticipation', 'reviewedDeliveries', 'reviews', 'squad']);
    expect(Object.values(s).some((v) => typeof v === 'number')).toBe(false);
    expect(s.authored.length).toBeGreaterThan(0);
  });
});
