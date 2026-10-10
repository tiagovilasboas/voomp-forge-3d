import type {
  ChangeRequest,
  Commit,
  Contributor,
  Deployment,
  ForgeSnapshot,
  ID,
  KnowledgeDocument,
  PipelineRun,
  ProductInitiative,
  Repository,
  Review,
  Squad,
} from '@domain/entities';
import type { ChangeRequestEvidence } from '@domain/rules/changeRequestProgress';

/** Lookup tables built once per snapshot. Lists are sorted newest first. */
export interface ForgeIndex {
  snapshot: ForgeSnapshot;
  squad: Map<ID, Squad>;
  repo: Map<ID, Repository>;
  person: Map<ID, Contributor>;
  cr: Map<ID, ChangeRequest>;
  initiative: Map<ID, ProductInitiative>;
  deployment: Map<ID, Deployment>;
  reposBySquad: Map<ID, Repository[]>;
  peopleBySquad: Map<ID, Contributor[]>;
  crsByRepo: Map<ID, ChangeRequest[]>;
  crsByInitiative: Map<ID, ChangeRequest[]>;
  crsByAuthor: Map<ID, ChangeRequest[]>;
  reviewsByCr: Map<ID, Review[]>;
  reviewsByPerson: Map<ID, Review[]>;
  commitsByRepo: Map<ID, Commit[]>;
  runsByRepo: Map<ID, PipelineRun[]>;
  runsBySha: Map<string, PipelineRun[]>;
  deploymentsByRepo: Map<ID, Deployment[]>;
  deploymentsByCr: Map<ID, Deployment[]>;
  document: Map<ID, KnowledgeDocument>;
  docsByInitiative: Map<ID, KnowledgeDocument[]>;
  docsByRepo: Map<ID, KnowledgeDocument[]>;
  docsBySquad: Map<ID, KnowledgeDocument[]>;
}

function groupBy<T>(items: T[], keys: (t: T) => (ID | null)[], date: (t: T) => string): Map<ID, T[]> {
  const map = new Map<ID, T[]>();
  for (const item of items) {
    for (const key of keys(item)) {
      if (key == null) continue;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
  }
  for (const list of map.values()) list.sort((a, b) => date(b).localeCompare(date(a)));
  return map;
}

const byId = <T extends { id: ID }>(items: T[]) => new Map(items.map((x) => [x.id, x]));
const noDate = () => '';

export function buildIndex(s: ForgeSnapshot): ForgeIndex {
  return {
    snapshot: s,
    squad: byId(s.squads),
    repo: byId(s.repositories),
    person: byId(s.contributors),
    cr: byId(s.changeRequests),
    initiative: byId(s.initiatives),
    deployment: byId(s.deployments),
    reposBySquad: groupBy(s.repositories, (r) => [r.squadId], noDate),
    peopleBySquad: groupBy(s.contributors, (c) => [c.squadId], noDate),
    crsByRepo: groupBy(s.changeRequests, (c) => [c.repositoryId], (c) => c.createdAt),
    crsByInitiative: groupBy(s.changeRequests, (c) => [c.initiativeId], (c) => c.createdAt),
    crsByAuthor: groupBy(s.changeRequests, (c) => [c.authorId], (c) => c.createdAt),
    reviewsByCr: groupBy(s.reviews, (r) => [r.changeRequestId], (r) => r.submittedAt),
    reviewsByPerson: groupBy(s.reviews, (r) => [r.reviewerId], (r) => r.submittedAt),
    commitsByRepo: groupBy(s.commits, (c) => [c.repositoryId], (c) => c.committedAt),
    runsByRepo: groupBy(s.pipelineRuns, (r) => [r.repositoryId], (r) => r.startedAt),
    runsBySha: groupBy(s.pipelineRuns, (r) => [r.headSha], (r) => r.startedAt),
    deploymentsByRepo: groupBy(s.deployments, (d) => [d.repositoryId], (d) => d.createdAt),
    deploymentsByCr: groupBy(s.deployments, (d) => d.changeRequestIds, (d) => d.createdAt),
    document: byId(s.documents),
    docsByInitiative: groupBy(s.documents, (d) => d.initiativeIds, (d) => d.updatedAt),
    docsByRepo: groupBy(s.documents, (d) => d.repositoryIds, (d) => d.updatedAt),
    docsBySquad: groupBy(s.documents, (d) => [d.squadId], (d) => d.updatedAt),
  };
}

/** Gathers everything the domain rules need to judge one change request. */
export function evidenceFor(idx: ForgeIndex, cr: ChangeRequest): ChangeRequestEvidence {
  return {
    changeRequest: cr,
    reviews: idx.reviewsByCr.get(cr.id) ?? [],
    headRuns: idx.runsBySha.get(cr.headSha) ?? [],
    deployments: idx.deploymentsByCr.get(cr.id) ?? [],
    capabilities: idx.snapshot.source.capabilities,
  };
}
