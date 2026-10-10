import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from './demoSnapshot';

const now = new Date('2026-10-09T12:00:00Z');
const DAY = 86_400_000;
const s = buildDemoSnapshot(now);

describe('demo snapshot', () => {
  it('has the documented counts', () => {
    expect({
      squads: s.squads.length,
      repositories: s.repositories.length,
      contributors: s.contributors.length,
      changeRequests: s.changeRequests.length,
      pipelineRuns: s.pipelineRuns.length,
      deployments: s.deployments.length,
      initiatives: s.initiatives.length,
    }).toEqual({ squads: 7, repositories: 9, contributors: 12, changeRequests: 25, pipelineRuns: 8, deployments: 7, initiatives: 4 });
  });

  it('is a demo source', () => {
    expect(s.source.kind).toBe('demo');
  });

  it('is deterministic for the same now', () => {
    expect(buildDemoSnapshot(now)).toEqual(buildDemoSnapshot(new Date(now.getTime())));
  });

  it('never points to github.com', () => {
    expect(JSON.stringify(s)).not.toContain('github.com');
  });

  describe('referential integrity', () => {
    const ids = (items: Array<{ id: string }>) => new Set(items.map((i) => i.id));
    const squads = ids(s.squads);
    const repos = ids(s.repositories);
    const people = ids(s.contributors);
    const crs = ids(s.changeRequests);
    const initiatives = ids(s.initiatives);

    it('has unique ids', () => {
      for (const list of [s.squads, s.repositories, s.contributors, s.changeRequests, s.reviews, s.pipelineRuns, s.deployments, s.initiatives]) {
        expect(ids(list).size).toBe(list.length);
      }
    });

    it('repositories, contributors and initiatives point to existing squads', () => {
      for (const r of s.repositories) expect(squads.has(r.squadId)).toBe(true);
      for (const c of s.contributors) expect(squads.has(c.squadId)).toBe(true);
      for (const i of s.initiatives) expect(squads.has(i.ownerSquadId)).toBe(true);
    });

    it('change requests point to existing repo, author, reviewers and initiative', () => {
      for (const c of s.changeRequests) {
        expect(repos.has(c.repositoryId)).toBe(true);
        expect(people.has(c.authorId)).toBe(true);
        c.requestedReviewerIds.forEach((id) => expect(people.has(id)).toBe(true));
        if (c.initiativeId) expect(initiatives.has(c.initiativeId)).toBe(true);
      }
    });

    it('reviews point to existing change requests and reviewers', () => {
      for (const r of s.reviews) {
        expect(crs.has(r.changeRequestId)).toBe(true);
        expect(people.has(r.reviewerId)).toBe(true);
      }
    });

    it('commits point to existing repo, author and change request', () => {
      for (const c of s.commits) {
        expect(repos.has(c.repositoryId)).toBe(true);
        expect(people.has(c.authorId)).toBe(true);
        if (c.changeRequestId) expect(crs.has(c.changeRequestId)).toBe(true);
      }
    });

    it('pipeline runs point to existing repo and change request, with matching head sha', () => {
      for (const r of s.pipelineRuns) {
        expect(repos.has(r.repositoryId)).toBe(true);
        expect(r.changeRequestId && crs.has(r.changeRequestId)).toBeTruthy();
        expect(s.changeRequests.find((c) => c.id === r.changeRequestId)!.headSha).toBe(r.headSha);
      }
    });

    it('deployments point to existing repo and change requests of the same repo', () => {
      for (const d of s.deployments) {
        expect(repos.has(d.repositoryId)).toBe(true);
        for (const id of d.changeRequestIds) {
          expect(crs.has(id)).toBe(true);
          expect(s.changeRequests.find((c) => c.id === id)!.repositoryId).toBe(d.repositoryId);
        }
      }
    });
  });

  describe('dates', () => {
    const inLast30Days = (iso: string | null) => {
      if (iso === null) return;
      const t = Date.parse(iso);
      expect(t).toBeGreaterThanOrEqual(now.getTime() - 30 * DAY);
      expect(t).toBeLessThanOrEqual(now.getTime());
    };

    it('change requests are within the last 30 days and not in the future', () => {
      for (const c of s.changeRequests) [c.createdAt, c.mergedAt, c.closedAt].forEach(inLast30Days);
    });
    it('pipeline runs are within the last 30 days and not in the future', () => {
      for (const r of s.pipelineRuns) inLast30Days(r.startedAt);
    });
    it('deployments are within the last 30 days and not in the future', () => {
      for (const d of s.deployments) inLast30Days(d.createdAt);
    });
  });

  it('repo-legacy-checkout has no activity in the last 30 days', () => {
    const cutoff = now.getTime() - 30 * DAY;
    const id = 'repo-legacy-checkout';
    expect(s.repositories.some((r) => r.id === id)).toBe(true);
    const dates = [
      ...s.changeRequests.filter((c) => c.repositoryId === id).flatMap((c) => [c.createdAt, c.mergedAt, c.closedAt]),
      ...s.commits.filter((c) => c.repositoryId === id).map((c) => c.committedAt),
      ...s.pipelineRuns.filter((r) => r.repositoryId === id).map((r) => r.startedAt),
      ...s.deployments.filter((d) => d.repositoryId === id).map((d) => d.createdAt),
    ].filter((d): d is string => d !== null);
    for (const d of dates) expect(Date.parse(d)).toBeLessThan(cutoff);
  });

  it('no URL contains github.com', () => {
    const urls = [
      ...s.repositories.map((r) => r.webUrl),
      ...s.changeRequests.map((c) => c.webUrl),
      ...s.commits.map((c) => c.webUrl),
      ...s.pipelineRuns.map((r) => r.webUrl),
      ...s.deployments.map((d) => d.webUrl),
    ];
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).not.toContain('github.com');
  });
});

describe('knowledge documents', () => {
  const s = buildDemoSnapshot(new Date('2026-10-09T12:00:00Z'));
  it('link only to existing squads, initiatives and repositories', () => {
    const squads = new Set(s.squads.map((x) => x.id));
    const initiatives = new Set(s.initiatives.map((x) => x.id));
    const repos = new Set(s.repositories.map((x) => x.id));
    expect(s.documents.length).toBeGreaterThan(0);
    for (const d of s.documents) {
      if (d.squadId) expect(squads.has(d.squadId)).toBe(true);
      d.initiativeIds.forEach((id) => expect(initiatives.has(id)).toBe(true));
      d.repositoryIds.forEach((id) => expect(repos.has(id)).toBe(true));
      expect(d.webUrl).not.toContain('atlassian.net');
    }
  });
});

describe('work items and workstreams', () => {
  const keys = new Set(s.workItems.map((w) => w.key));

  it('has about 40 issues, 8 fronts and native capabilities', () => {
    expect(s.workItems.length).toBeGreaterThanOrEqual(38);
    expect(s.workstreams).toHaveLength(8);
    expect(s.source.capabilities.workItems).toBe('native');
    expect(s.source.capabilities.workstreams).toBe('native');
  });

  it('every change request task key exists as an issue; production issues carry productionAt', () => {
    for (const cr of s.changeRequests) for (const w of cr.workItems) expect(keys.has(w.key)).toBe(true);
    const inProd = new Set(s.deployments.filter((d) => d.environment === 'production' && d.status === 'success').flatMap((d) => d.changeRequestIds));
    for (const cr of s.changeRequests.filter((c) => inProd.has(c.id) && c.workItems.length)) {
      const item = s.workItems.find((w) => w.key === cr.workItems[0].key)!;
      expect(item.status).toBe('done');
      expect(item.productionAt).not.toBeNull();
    }
  });

  it('fronts reference existing squads, repos, people, initiatives and epics', () => {
    const ids = (l: Array<{ id: string }>) => new Set(l.map((x) => x.id));
    const squads = ids(s.squads), repos = ids(s.repositories), people = ids(s.contributors), inis = ids(s.initiatives);
    for (const ws of s.workstreams) {
      ws.squadIds.forEach((x) => expect(squads.has(x)).toBe(true));
      ws.repositoryIds.forEach((x) => expect(repos.has(x)).toBe(true));
      ws.epicKeys.forEach((k) => expect(s.workItems.find((w) => w.key === k)?.type).toBe('epic'));
      ws.team.forEach((t) => t.personId && expect(people.has(t.personId)).toBe(true));
      if (ws.initiativeId) expect(inis.has(ws.initiativeId)).toBe(true);
    }
    expect(s.workstreams.some((w) => w.squadIds.length === 2)).toBe(true);
    expect(s.workstreams.some((w) => w.team.some((t) => t.personId === null))).toBe(true);
  });

  it('links use .invalid domains', () => {
    for (const ws of s.workstreams) for (const l of ws.links) expect(new URL(l.url).hostname.endsWith('.invalid')).toBe(true);
  });

  it('has one in-flight production deployment triggered by a known contributor', () => {
    const s = buildDemoSnapshot(new Date('2026-05-10T12:00:00Z'));
    const running = s.deployments.filter((d) => d.environment === 'production' && d.status === 'running');
    expect(running).toHaveLength(1);
    expect(s.contributors.some((c) => c.id === running[0].triggeredById)).toBe(true);
  });
});
