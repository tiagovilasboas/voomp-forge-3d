import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '@application/contracts/parseSnapshot';
import { buildSnapshotFromGit, type ForgeIngestConfig, type RawGitCommit } from './buildSnapshotFromGit';

const NOW = '2026-02-01T00:00:00Z';

function commit(sha: string, parents: string[], day: number, email: string, subject: string, body = ''): RawGitCommit {
  return {
    sha, parents, authorName: email.split('@')[0].toUpperCase(), authorEmail: email,
    date: `2026-01-${String(day).padStart(2, '0')}T10:00:00Z`, subject, body,
  };
}

/*
 *  c1 - c2 ------- m1(#1, merge) -- c5 -- sq(#2 squash) -- m3 (non-PR)
 *   \              /
 *    f1 - f2 -----
 */
const commits: RawGitCommit[] = [
  commit('c1', [], 1, 'Ana@x.com', 'init'),
  commit('c2', ['c1'], 2, 'ana@x.com', 'more'),
  commit('f1', ['c1'], 3, 'Bob@x.com', 'ATL-7 start INI-1'),
  commit('f2', ['f1'], 4, 'bob@x.com', 'finish'),
  commit('m1', ['c2', 'f2'], 5, 'ana@x.com', 'Merge pull request #1 from org/feat/ATL-7-retry', 'Retry radio INI-1'),
  commit('c5', ['m1'], 6, 'ana@x.com', 'tweak'),
  commit('sq', ['c5'], 8, 'carl@x.com', 'Add reports (#2)'),
  commit('c9', ['sq'], 12, 'ana@x.com', 'docs'),
];

const config: ForgeIngestConfig = {
  organization: { name: 'Acme Corp' },
  squads: [{ id: 'sq-a', code: 'A', name: 'Alpha', repositories: [{ path: '/r/api', webUrl: 'https://git.example/acme/api' }] }],
  people: [{ email: 'ANA@x.com', displayName: 'Ana Souza', role: 'tech-lead' }],
  initiatives: [{ key: 'INI-1', name: 'Rotas da oficina' }],
  initiativePattern: 'INI-\\d+',
  workItemUrlTemplate: 'https://tracker/browse/{key}',
  deployments: [{ environment: 'production', tagPattern: '^v\\d+' }],
};

const build = (c: ForgeIngestConfig = config, tags = [
  { name: 'v1.0', sha: 'c5', date: '2026-01-07T00:00:00Z' },
  { name: 'v1.1', sha: 'c9', date: '2026-01-13T00:00:00Z' },
  { name: 'nightly', sha: 'c9', date: '2026-01-13T00:00:00Z' },
]) => buildSnapshotFromGit({ config: c, repos: { '/r/api': { commits, tags } }, generatedAt: NOW });

describe('buildSnapshotFromGit', () => {
  it('produces a valid, deterministic snapshot', () => {
    const a = build();
    expect(() => parseSnapshot(JSON.parse(JSON.stringify(a)))).not.toThrow();
    expect(JSON.stringify(a)).toBe(JSON.stringify(build()));
  });

  it('declares inferred capabilities', () => {
    const s = build();
    expect(s.source.kind).toBe('imported');
    expect(s.source.provider.vocabulary.changeRequestShort).toBe('Merge');
    expect(s.source.capabilities).toEqual({ changeRequests: 'inferred', reviews: 'unavailable', pipelines: 'unavailable', deployments: 'inferred', documents: 'unavailable', workItems: 'unavailable', workstreams: 'unavailable' });
    expect(build({ ...config, deployments: [] }).source.capabilities.deployments).toBe('unavailable');
  });

  it('infers merge and squash change requests', () => {
    const [merge, squash] = build().changeRequests;
    expect(merge).toMatchObject({
      id: 'cr-repo-api-1', origin: 'merge-commit', state: 'merged', number: 1, title: 'Retry radio INI-1',
      headSha: 'f2', mergeCommitSha: 'm1', createdAt: '2026-01-03T10:00:00Z', mergedAt: '2026-01-05T10:00:00Z',
      authorId: 'ct-bob-x-com', initiativeId: 'ini-ini-1',
    });
    expect(merge.workItems).toEqual([{ key: 'ATL-7', url: 'https://tracker/browse/ATL-7' }]);
    expect(merge.webUrl).toBe('https://git.example/acme/api/commit/m1');
    expect(squash).toMatchObject({ number: 2, title: 'Add reports', authorId: 'ct-carl-x-com', headSha: 'sq', initiativeId: null });
  });

  it('attributes only branch commits to the merge', () => {
    const byCr = Object.fromEntries(build().commits.map((c) => [c.sha, c.changeRequestId]));
    expect(byCr).toMatchObject({ f1: 'cr-repo-api-1', f2: 'cr-repo-api-1', m1: 'cr-repo-api-1', sq: 'cr-repo-api-2', c1: null, c2: null, c5: null, c9: null });
  });

  it('links deployments to change requests not in the previous tag', () => {
    const deps = build().deployments;
    expect(deps.map((d) => [d.ref, d.changeRequestIds])).toEqual([
      ['v1.0', ['cr-repo-api-1']],
      ['v1.1', ['cr-repo-api-2']],
    ]);
    expect(deps[0]).toMatchObject({ environment: 'production', status: 'success', sha: 'c5' });
  });

  it('dedupes contributors by lowercased email and merges config', () => {
    const cts = build().contributors;
    expect(cts.map((c) => c.id)).toEqual(['ct-ana-x-com', 'ct-bob-x-com', 'ct-carl-x-com']);
    expect(cts[0]).toMatchObject({ displayName: 'Ana Souza', role: 'tech-lead', squadId: 'sq-a' });
    expect(cts[1].role).toBeNull();
  });

  it('rejects invalid config', () => {
    expect(() => build({ ...config, deployments: [{ environment: 'qa' as never, tagPattern: '.' }] })).toThrow(/Ambiente/);
    expect(() => build({ ...config, squads: [] })).toThrow(/squad/);
  });
});
