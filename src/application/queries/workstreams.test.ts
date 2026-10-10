import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '@infrastructure/demo/demoSnapshot';
import { buildIndex } from './forgeIndex';
import type { ScopeFilter } from './period';
import { allocationMatrix, listWorkstreams, workstreamRoadmap, workstreamView } from './workstreams';

const now = new Date('2026-10-09T12:00:00Z');
const idx = buildIndex(buildDemoSnapshot(now));
const scope: ScopeFilter = { periodDays: 30, squadId: null, now };
const view = (id: string) => workstreamView(idx, idx.workstream.get(id)!, scope);

describe('workstream queries', () => {
  it('indexes work items by key and epic, and fronts by id', () => {
    expect(idx.workItem.get('ADM-100')?.type).toBe('epic');
    expect((idx.workItemsByEpic.get('ADM-130') ?? []).length).toBe(4);
    expect(idx.workstream.size).toBe(8);
  });

  it('links changes through task keys', () => {
    const v = view('ws-retentativa-cobrancas');
    expect(v.changes.map((d) => d.cr.number)).toEqual([301]);
    expect(v.progress.status).toBe('delivered');
    expect(v.progress.evidence).toEqual(['tracker', 'git']);
    expect(v.progress.divergence).toBe(false);
  });

  it('links changes by initiative restricted to declared repositories', () => {
    const v = view('ws-painel-financeiro');
    expect(v.changes.every((d) => d.repo.name === 'bancada-web')).toBe(true);
    expect(v.changes.some((d) => d.cr.initiativeId === 'ini-financial-panel')).toBe(true);
  });

  it('a front declared done without evidence is not delivered', () => {
    const v = view('ws-gateway-v2');
    expect(v.workstream.declaredDone).toBe(true);
    expect(v.progress.status).not.toBe('delivered');
    expect(v.progress.declaredWithoutEvidence).toBe(true);
  });

  it('accepts tracker-only evidence and flags Jira/Git divergence', () => {
    const tracker = view('ws-minhas-compras');
    expect(tracker.changes).toHaveLength(0);
    expect(tracker.progress.status).toBe('delivered');
    expect(tracker.progress.evidence).toEqual(['tracker']);
    const diverging = view('ws-retirada-pecas');
    expect(diverging.progress.divergence).toBe(true);
    expect(diverging.progress.status).not.toBe('delivered');
  });

  it('derives squads and people, including display-only names', () => {
    const v = view('ws-verificacao-identidade');
    expect(v.squads.map((s) => s.id).sort()).toEqual(['sq-admin', 'sq-n3']);
    expect(v.people.some((p) => p.person === null && p.assignment.role === 'n2')).toBe(true);
  });

  it('squad filter is many-to-many (declared squads or team members)', () => {
    const names = (squadId: string) => listWorkstreams(idx, scope, { squadId }).map((v) => v.workstream.id);
    expect(names('sq-enable')).toContain('ws-retirada-pecas'); // declared squad
    expect(names('sq-admin')).toContain('ws-retirada-pecas');
    expect(names('sq-n3')).toContain('ws-verificacao-identidade'); // declared + member
    expect(names('sq-n3')).toContain('ws-painel-financeiro'); // only via a member (QA from N3)
    expect(names('sq-enable')).not.toContain('ws-gateway-v2');
  });

  it('sorts by category then risk and filters by category and status', () => {
    const all = listWorkstreams(idx, scope);
    expect(all).toHaveLength(8);
    const order = ['sprint_priority', 'closing', 'sustaining', 'open_topic'];
    const cats = all.map((v) => order.indexOf(v.workstream.category));
    expect(cats).toEqual([...cats].sort((a, b) => a - b));
    expect(all[0].progress.status).toBe('blocked');
    expect(listWorkstreams(idx, scope, { category: 'closing' })).toHaveLength(2);
    expect(listWorkstreams(idx, scope, { status: 'delivered' }).map((v) => v.workstream.id).sort()).toEqual(['ws-minhas-compras', 'ws-retentativa-cobrancas']);
  });

  it('allocation matrix is a planning view with no numeric scores', () => {
    const m = allocationMatrix(idx);
    expect(m.columns).toHaveLength(8);
    expect(m.rows.some((r) => r.personId === null)).toBe(true);
    const iara = m.rows.find((r) => r.personId === 'ct-iara-v')!;
    expect(iara.assignments.length).toBeGreaterThan(1);
    const numeric = (o: unknown): boolean =>
      typeof o === 'number' || (typeof o === 'object' && o !== null && Object.values(o).some(numeric));
    expect(numeric(m)).toBe(false);
  });

  it('roadmap lists plan history and delivery date', () => {
    const r = workstreamRoadmap(idx, scope);
    const compras = r.find((e) => e.workstream.id === 'ws-minhas-compras')!;
    expect(compras.plans).toHaveLength(3);
    expect(compras.plans.filter((p) => p.current)).toHaveLength(1);
    expect(compras.deliveredAt).not.toBeNull();
    expect(r.find((e) => e.workstream.id === 'ws-fichas-sem-dono')!.deliveredAt).toBeNull();
  });
});
