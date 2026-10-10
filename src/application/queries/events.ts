import type { ID, ISODate } from '@domain/entities';
import type { ForgeIndex } from './forgeIndex';
import { inPeriod, inSquad, type ScopeFilter } from './period';

export type DeliveryEventKind = 'merged' | 'pipeline_failed' | 'deployed_staging' | 'deployed_production';

/** Normalised engineering event, used for the light flows in the scene and activity feeds. */
export interface DeliveryEvent {
  id: string;
  kind: DeliveryEventKind;
  at: ISODate;
  repoId: ID;
  squadId: ID;
  changeRequestId: ID | null;
  deploymentId: ID | null;
}

export function listEvents(idx: ForgeIndex, scope: ScopeFilter): DeliveryEvent[] {
  const s = idx.snapshot;
  const squadOf = (repoId: ID) => idx.repo.get(repoId)?.squadId ?? '';
  const events: DeliveryEvent[] = [
    ...s.changeRequests
      .filter((cr) => cr.mergedAt)
      .map((cr) => ({ id: `ev-m-${cr.id}`, kind: 'merged' as const, at: cr.mergedAt!, repoId: cr.repositoryId, changeRequestId: cr.id, deploymentId: null })),
    ...s.pipelineRuns
      .filter((r) => r.status === 'failure')
      .map((r) => ({ id: `ev-f-${r.id}`, kind: 'pipeline_failed' as const, at: r.startedAt, repoId: r.repositoryId, changeRequestId: r.changeRequestId, deploymentId: null })),
    ...s.deployments
      .filter((d) => d.status === 'success')
      .map((d) => ({
        id: `ev-d-${d.id}`,
        kind: d.environment === 'production' ? ('deployed_production' as const) : ('deployed_staging' as const),
        at: d.createdAt,
        repoId: d.repositoryId,
        changeRequestId: null,
        deploymentId: d.id,
      })),
  ].map((e) => ({ ...e, squadId: squadOf(e.repoId) }));

  return events.filter((e) => inPeriod(scope, e.at) && inSquad(scope, e.squadId)).sort((a, b) => b.at.localeCompare(a.at));
}
