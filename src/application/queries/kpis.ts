import type { ForgeIndex } from './forgeIndex';
import { toDelivery } from './deliveries';
import { inPeriod, inSquad, type ScopeFilter } from './period';

export interface Kpis {
  merged: number;
  awaitingReview: number;
  pipelineFailures: number;
  productionDeploys: number;
  initiativeDeliveries: number;
}

/** Headline indicators for the current scope. Every number is period- and squad-aware. */
export function computeKpis(idx: ForgeIndex, scope: ScopeFilter): Kpis {
  const squadOfRepo = (repoId: string) => idx.repo.get(repoId)?.squadId ?? '';
  const crs = idx.snapshot.changeRequests.filter((cr) => inSquad(scope, squadOfRepo(cr.repositoryId)));
  const merged = crs.filter((cr) => inPeriod(scope, cr.mergedAt));

  return {
    merged: merged.length,
    awaitingReview: crs.filter(
      (cr) => inPeriod(scope, cr.createdAt) && toDelivery(idx, cr).status === 'awaiting_review',
    ).length,
    pipelineFailures: idx.snapshot.pipelineRuns.filter(
      (r) => r.status === 'failure' && inPeriod(scope, r.startedAt) && inSquad(scope, squadOfRepo(r.repositoryId)),
    ).length,
    productionDeploys: idx.snapshot.deployments.filter(
      (d) =>
        d.environment === 'production' &&
        d.status === 'success' &&
        inPeriod(scope, d.createdAt) &&
        inSquad(scope, squadOfRepo(d.repositoryId)),
    ).length,
    initiativeDeliveries: merged.filter((cr) => cr.initiativeId !== null).length,
  };
}
