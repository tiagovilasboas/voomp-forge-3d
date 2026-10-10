import { describe, expect, it } from 'vitest';
import type { Contributor, Squad, Workstream } from '@domain/entities';
import { mergeFragments } from './mergeFragments';

const now = new Date('2026-01-10T12:00:00Z');
const squad = (id: string, name: string): Squad => ({ id, code: 'A', name, description: '' });
const ws = (over: Partial<Workstream>): Workstream => ({
  id: 'w1', name: 'W', category: 'sprint_priority', squadIds: [], initiativeId: null, repositoryIds: [], epicKeys: [],
  team: [], plans: [], dependencies: [], declaredDone: false, links: [], notes: [], ...over,
});

describe('mergeFragments', () => {
  it('uses defaults for an empty list', () => {
    const s = mergeFragments([], now);
    expect(s.organization.id).toBe('org-default');
    expect(s.source.generatedAt).toBe(now.toISOString());
    expect(s.source.capabilities.workItems).toBe('unavailable');
    expect(s.squads).toEqual([]);
  });

  it('dedupes by id with the later fragment winning, and takes best capability', () => {
    const s = mergeFragments(
      [
        { squads: [squad('s1', 'Antiga'), squad('s2', 'Outra')], capabilities: { workItems: 'inferred', deployments: 'native' } },
        { squads: [squad('s1', 'Nova')], capabilities: { workItems: 'native', deployments: 'inferred' } },
      ],
      now,
    );
    expect(s.squads.map((q) => q.name)).toEqual(['Nova', 'Outra']);
    expect(s.source.capabilities.workItems).toBe('native');
    expect(s.source.capabilities.deployments).toBe('native');
  });

  it('takes organization and provider from the first fragment that has them', () => {
    const provider = { id: 'gl', name: 'GitLab', vocabulary: { changeRequest: 'MR', changeRequestShort: 'MR', pipeline: 'Pipeline' } };
    const s = mergeFragments(
      [{}, { organization: { id: 'o1', name: 'A', slug: 'a' }, provider }, { organization: { id: 'o2', name: 'B', slug: 'b' } }],
      now,
    );
    expect(s.organization.id).toBe('o1');
    expect(s.source.provider.id).toBe('gl');
  });

  it('fills workstream squads from team members when empty', () => {
    const ct: Contributor = { id: 'ct-ana', displayName: 'Ana', handle: 'ana', squadId: 's1', role: null };
    const s = mergeFragments(
      [
        { contributors: [ct] },
        {
          workstreams: [
            ws({ id: 'a', team: [{ role: 'dev', personId: 'ct-ana', displayName: 'Ana', specialty: null }, { role: 'qa', personId: null, displayName: 'X', specialty: null }] }),
            ws({ id: 'b', squadIds: ['s9'], team: [{ role: 'dev', personId: 'ct-ana', displayName: 'Ana', specialty: null }] }),
          ],
        },
      ],
      now,
    );
    expect(s.workstreams.find((w) => w.id === 'a')?.squadIds).toEqual(['s1']);
    expect(s.workstreams.find((w) => w.id === 'b')?.squadIds).toEqual(['s9']);
  });
});
