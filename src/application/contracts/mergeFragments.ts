import type {
  CapabilityLevel,
  Organization,
  ProviderInfo,
  ForgeSnapshot,
  SourceCapabilities,
  Workstream,
} from '@domain/entities';
import { SNAPSHOT_SCHEMA_VERSION } from '@domain/entities';
import type { SnapshotFragment } from '../ports/connectors';

const DEFAULT_ORGANIZATION: Organization = { id: 'org-default', name: 'Organização', slug: 'organizacao' };
const DEFAULT_PROVIDER: ProviderInfo = {
  id: 'git',
  name: 'Git',
  vocabulary: { changeRequest: 'Merge', changeRequestShort: 'Merge', pipeline: 'Pipeline' },
};

const RANK: Record<CapabilityLevel, number> = { unavailable: 0, inferred: 1, native: 2 };
const CAPABILITY_KEYS: (keyof SourceCapabilities)[] = [
  'changeRequests',
  'reviews',
  'pipelines',
  'deployments',
  'documents',
  'workItems',
  'workstreams',
];

/** Concatenates by key; a later item replaces an earlier one with the same key but keeps its position. */
function mergeBy<T>(lists: (T[] | undefined)[], keyOf: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const list of lists) for (const item of list ?? []) map.set(keyOf(item), item);
  return [...map.values()];
}

function mergeCapabilities(fragments: SnapshotFragment[]): SourceCapabilities {
  const result = Object.fromEntries(CAPABILITY_KEYS.map((k) => [k, 'unavailable'])) as unknown as SourceCapabilities;
  for (const fragment of fragments) {
    for (const key of CAPABILITY_KEYS) {
      const level = fragment.capabilities?.[key];
      if (level && RANK[level] > RANK[result[key]]) result[key] = level;
    }
  }
  return result;
}

/**
 * Pure: merges connector fragments into one snapshot. Later fragments win on id/key conflicts;
 * capabilities keep the best level; organization/provider come from the first fragment that has one.
 */
export function mergeFragments(fragments: SnapshotFragment[], now: Date): ForgeSnapshot {
  const contributors = mergeBy(fragments.map((f) => f.contributors), (c) => c.id);
  const squadOfPerson = new Map(contributors.map((c) => [c.id, c.squadId]));

  const workstreams = mergeBy<Workstream>(fragments.map((f) => f.workstreams), (w) => w.id).map((w) => {
    if (w.squadIds.length > 0) return w;
    const squadIds = [
      ...new Set(w.team.map((t) => (t.personId ? squadOfPerson.get(t.personId) : undefined)).filter((s): s is string => !!s)),
    ];
    return squadIds.length > 0 ? { ...w, squadIds } : w;
  });

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    source: {
      kind: 'imported',
      provider: fragments.find((f) => f.provider)?.provider ?? DEFAULT_PROVIDER,
      capabilities: mergeCapabilities(fragments),
      generatedAt: now.toISOString(),
    },
    organization: fragments.find((f) => f.organization)?.organization ?? DEFAULT_ORGANIZATION,
    squads: mergeBy(fragments.map((f) => f.squads), (s) => s.id),
    repositories: mergeBy(fragments.map((f) => f.repositories), (r) => r.id),
    contributors,
    changeRequests: mergeBy(fragments.map((f) => f.changeRequests), (c) => c.id),
    reviews: mergeBy(fragments.map((f) => f.reviews), (r) => r.id),
    commits: mergeBy(fragments.map((f) => f.commits), (c) => `${c.repositoryId}:${c.sha}`),
    pipelineRuns: mergeBy(fragments.map((f) => f.pipelineRuns), (p) => p.id),
    deployments: mergeBy(fragments.map((f) => f.deployments), (d) => d.id),
    initiatives: mergeBy(fragments.map((f) => f.initiatives), (i) => i.id),
    documents: mergeBy(fragments.map((f) => f.documents), (d) => d.id),
    workItems: mergeBy(fragments.map((f) => f.workItems), (w) => w.key),
    workstreams,
  };
}
