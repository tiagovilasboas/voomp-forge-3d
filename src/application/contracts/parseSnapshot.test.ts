import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '@infrastructure/demo/demoSnapshot';
import { parseSnapshot, SnapshotValidationError } from './parseSnapshot';

const fresh = () => JSON.parse(JSON.stringify(buildDemoSnapshot(new Date('2026-01-15T12:00:00Z')))) as Record<string, any>;

function issuesOf(json: unknown): string[] {
  try {
    parseSnapshot(json);
  } catch (e) {
    expect(e).toBeInstanceOf(SnapshotValidationError);
    return (e as SnapshotValidationError).issues;
  }
  throw new Error('esperava falha de validação');
}

describe('parseSnapshot', () => {
  it('accepts the demo snapshot', () => {
    const snap = fresh();
    expect(parseSnapshot(snap).organization.slug).toBe('voomp-demo');
  });

  it('rejects non-objects', () => {
    expect(issuesOf(null)[0]).toMatch(/objeto JSON/);
    expect(issuesOf([])[0]).toMatch(/objeto JSON/);
  });

  it('rejects a wrong schemaVersion', () => {
    const s = fresh();
    s.schemaVersion = 99;
    expect(issuesOf(s)[0]).toMatch(/schemaVersion/);
  });

  it('reports missing arrays', () => {
    const s = fresh();
    delete s.squads;
    expect(issuesOf(s)).toContain('squads: esperada uma lista.');
  });

  it('reports invalid enum values', () => {
    const s = fresh();
    s.changeRequests[0].state = 'mergeado';
    s.source.capabilities.reviews = 'maybe';
    const issues = issuesOf(s);
    expect(issues.some((i) => i.startsWith('changeRequests[0].state') && i.includes('"mergeado"'))).toBe(true);
    expect(issues.some((i) => i.startsWith('source.capabilities.reviews'))).toBe(true);
  });

  it('reports broken references', () => {
    const s = fresh();
    s.repositories[0].squadId = 'sq-x';
    s.changeRequests[0].authorId = 'ct-x';
    s.changeRequests[0].initiativeId = 'ini-x';
    s.reviews[0].changeRequestId = 'cr-x';
    s.deployments[0].changeRequestIds = ['cr-x'];
    const issues = issuesOf(s);
    expect(issues).toContain('repositories[0].squadId: "sq-x" não existe em squads.');
    expect(issues).toContain('changeRequests[0].authorId: "ct-x" não existe em contributors.');
    expect(issues.some((i) => i.includes('initiativeId'))).toBe(true);
    expect(issues.some((i) => i.startsWith('reviews[0].changeRequestId'))).toBe(true);
    expect(issues.some((i) => i.startsWith('deployments[0].changeRequestIds'))).toBe(true);
  });

  it('reports duplicate ids and bad dates', () => {
    const s = fresh();
    s.squads[1].id = s.squads[0].id;
    s.commits[0].committedAt = 'ontem';
    const issues = issuesOf(s);
    expect(issues.some((i) => i.includes('id duplicado'))).toBe(true);
    expect(issues.some((i) => i.startsWith('commits[0].committedAt'))).toBe(true);
  });

  it('caps the number of issues at 20', () => {
    const s = fresh();
    for (const cr of s.changeRequests) cr.repositoryId = 'nope';
    const issues = issuesOf(s);
    expect(issues).toHaveLength(20);
    expect(issues[19]).toMatch(/^… e mais \d+ problemas/);
  });
});
