import { useMemo } from 'react';
import { listDeliveries, STATUS_GROUP, type Delivery } from '@application/queries/deliveries';
import { inPeriod, inSquad } from '@application/queries/period';
import type { Deployment, PipelineRun } from '@domain/entities';
import { useReadyData } from '@presentation/state/dataStore';
import { useScope } from '@presentation/state/selectors';

export interface Activity {
  deliveries: Delivery[];
  reviews: Delivery[];
  pipelines: PipelineRun[];
  deploys: Deployment[];
}

/** The four queues shown in the activity card, already limited to the current scope. */
export function useActivity(): Activity {
  const { index } = useReadyData();
  const scope = useScope();
  return useMemo(() => {
    const squadOf = (repoId: string) => index.repo.get(repoId)?.squadId ?? '';
    const all = listDeliveries(index, scope);
    const s = index.snapshot;
    return {
      deliveries: all.filter((d) => ['production', 'staging', 'integrated'].includes(STATUS_GROUP[d.status])),
      reviews: all.filter((d) => d.status === 'awaiting_review' || d.status === 'changes_requested'),
      pipelines: s.pipelineRuns
        .filter((r) => inPeriod(scope, r.startedAt) && inSquad(scope, squadOf(r.repositoryId)))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      deploys: s.deployments
        .filter((d) => inPeriod(scope, d.createdAt) && inSquad(scope, squadOf(d.repositoryId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }, [index, scope]);
}
