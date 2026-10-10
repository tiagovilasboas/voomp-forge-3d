import { describe, expect, it } from 'vitest';
import type { WorkItem, Workstream } from '@domain/entities';
import { workstreamProgress, type LinkedChange } from './workstreamProgress';

const now = new Date('2026-10-09T12:00:00Z');

const ws = (o: Partial<Workstream> = {}): Workstream => ({
  id: 'ws-1',
  name: 'Frente',
  category: 'sprint_priority',
  squadIds: [],
  initiativeId: null,
  repositoryIds: [],
  epicKeys: ['EP-1'],
  team: [],
  plans: [{ label: 'Semana 2', target: '2026-10-15T00:00:00Z', recordedAt: '2026-10-01T00:00:00Z' }],
  dependencies: [],
  declaredDone: false,
  links: [],
  notes: [],
  ...o,
});

const item = (status: WorkItem['status']): WorkItem => ({
  key: `T-${Math.random()}`,
  title: 't',
  type: 'story',
  status,
  statusName: status,
  epicKey: 'EP-1',
  sprint: null,
  updatedAt: '2026-10-05T00:00:00Z',
  productionAt: null,
  url: null,
});
const shipped = (at: string): WorkItem => ({ ...item('done'), productionAt: at });

const prod = (at: string): LinkedChange => ({ status: 'in_production', productionAt: at });
const change = (status: LinkedChange['status']): LinkedChange => ({ status, productionAt: null });

describe('workstreamProgress', () => {
  it('is delivered only with production evidence and every issue done', () => {
    const p = workstreamProgress({ workstream: ws(), workItems: [item('done')], changes: [prod('2026-10-08T10:00:00Z')], now });
    expect(p.status).toBe('delivered');
    expect(p.onTime).toBe(true);
  });

  it('merged is not delivered', () => {
    const p = workstreamProgress({ workstream: ws(), workItems: [item('done')], changes: [change('merged')], now });
    expect(p.status).toBe('in_progress');
  });

  it('flags a front declared done without production evidence', () => {
    const p = workstreamProgress({ workstream: ws({ declaredDone: true }), workItems: [], changes: [change('in_staging')], now });
    expect(p.status).not.toBe('delivered');
    expect(p.declaredWithoutEvidence).toBe(true);
  });

  it('is blocked by a declared blocker or a blocked change', () => {
    expect(workstreamProgress({ workstream: ws({ dependencies: [{ description: 'SRE', kind: 'blocker' }] }), workItems: [], changes: [], now }).status).toBe('blocked');
    expect(workstreamProgress({ workstream: ws(), workItems: [], changes: [change('ci_failed')], now }).status).toBe('blocked');
  });

  it('is at risk when the committed date passed without delivery', () => {
    const late = ws({ plans: [{ label: 'Semana 1', target: '2026-10-02T00:00:00Z', recordedAt: '2026-09-25T00:00:00Z' }] });
    expect(workstreamProgress({ workstream: late, workItems: [item('in_progress')], changes: [], now }).status).toBe('at_risk');
  });

  it('counts replans from the plan history', () => {
    const replanned = ws({
      plans: [
        { label: 'Semana 1', target: '2026-10-02T00:00:00Z', recordedAt: '2026-09-25T00:00:00Z' },
        { label: 'Semana 2', target: '2026-10-09T00:00:00Z', recordedAt: '2026-10-02T00:00:00Z' },
        { label: 'Semana 3', target: '2026-10-16T00:00:00Z', recordedAt: '2026-10-08T00:00:00Z' },
      ],
    });
    expect(workstreamProgress({ workstream: replanned, workItems: [], changes: [], now }).replans).toBe(2);
  });

  it('treats sustaining work without a date as on demand', () => {
    const sustaining = ws({ category: 'sustaining', plans: [{ label: 'Sob demanda', target: null, recordedAt: '2026-10-01T00:00:00Z' }] });
    expect(workstreamProgress({ workstream: sustaining, workItems: [], changes: [], now }).status).toBe('on_demand');
  });

  it('is planned when nothing started', () => {
    expect(workstreamProgress({ workstream: ws(), workItems: [item('todo')], changes: [], now }).status).toBe('planned');
  });

  it('accepts production evidence from the tracker (Jira) alone', () => {
    const p = workstreamProgress({ workstream: ws(), workItems: [shipped('2026-10-07T10:00:00Z')], changes: [], now });
    expect(p.status).toBe('delivered');
    expect(p.evidence).toEqual(['tracker']);
  });

  it('flags divergence when Jira says production but the linked change was not deployed', () => {
    const p = workstreamProgress({ workstream: ws(), workItems: [shipped('2026-10-07T10:00:00Z')], changes: [change('merged')], now });
    expect(p.divergence).toBe(true);
    expect(p.status).not.toBe('delivered');
  });

  it('flags divergence when Git deployed but Jira issues are still open', () => {
    const p = workstreamProgress({ workstream: ws(), workItems: [item('in_progress')], changes: [prod('2026-10-08T10:00:00Z')], now });
    expect(p.divergence).toBe(true);
    expect(p.status).not.toBe('delivered');
  });

  it('records both sources when Jira and Git agree', () => {
    const p = workstreamProgress({ workstream: ws(), workItems: [shipped('2026-10-07T10:00:00Z')], changes: [prod('2026-10-08T10:00:00Z')], now });
    expect(p.status).toBe('delivered');
    expect(p.evidence).toEqual(['tracker', 'git']);
    expect(p.deliveredAt).toBe('2026-10-08T10:00:00Z');
  });
});
