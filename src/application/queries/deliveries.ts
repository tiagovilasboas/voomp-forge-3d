import type {
  ChangeRequest,
  DeploymentEnvironment,
  ID,
  ISODate,
  ProductInitiative,
  Repository,
  Squad,
} from '@domain/entities';
import { deliveryStatus, timeline, type DeliveryStatus, type Stage } from '@domain/rules/changeRequestProgress';
import { evidenceFor, type ForgeIndex } from './forgeIndex';
import { inPeriod, inSquad, latest, type ScopeFilter } from './period';

/**
 * A "delivery" is a change request seen through the evidence it has gathered.
 * It is the unit shown in the Delivery Explorer, Product View and panels.
 */
export interface Delivery {
  cr: ChangeRequest;
  repo: Repository;
  squad: Squad;
  initiative: ProductInitiative | null;
  status: DeliveryStatus;
  stages: Stage[];
  environments: DeploymentEnvironment[];
  lastActivityAt: ISODate;
}

/** Coarse groups used by filters and the legend. */
export type StatusGroup = 'production' | 'staging' | 'integrated' | 'review' | 'blocked' | 'draft' | 'closed';

export const STATUS_GROUP: Record<DeliveryStatus, StatusGroup> = {
  in_production: 'production',
  in_staging: 'staging',
  merged: 'integrated',
  approved: 'review',
  awaiting_review: 'review',
  changes_requested: 'blocked',
  ci_failed: 'blocked',
  draft: 'draft',
  closed: 'closed',
};

export function toDelivery(idx: ForgeIndex, cr: ChangeRequest): Delivery {
  const evidence = evidenceFor(idx, cr);
  const repo = idx.repo.get(cr.repositoryId)!;
  const okDeploys = evidence.deployments.filter((d) => d.status === 'success');
  return {
    cr,
    repo,
    squad: idx.squad.get(repo.squadId)!,
    initiative: cr.initiativeId ? (idx.initiative.get(cr.initiativeId) ?? null) : null,
    status: deliveryStatus(evidence),
    stages: timeline(evidence),
    environments: [...new Set(okDeploys.map((d) => d.environment))],
    lastActivityAt:
      latest([
        cr.createdAt,
        cr.mergedAt,
        cr.closedAt,
        ...evidence.reviews.map((r) => r.submittedAt),
        ...evidence.deployments.map((d) => d.createdAt),
      ]) ?? cr.createdAt,
  };
}

export interface DeliveryFilter {
  repoId?: ID | null;
  status?: StatusGroup | null;
  /** `'none'` = change requests without an identified initiative. */
  initiativeId?: ID | 'none' | null;
  environment?: DeploymentEnvironment | null;
  text?: string;
}

export function listDeliveries(idx: ForgeIndex, scope: ScopeFilter, f: DeliveryFilter = {}): Delivery[] {
  const text = f.text?.trim().toLowerCase();
  return idx.snapshot.changeRequests
    .map((cr) => toDelivery(idx, cr))
    .filter(
      (d) =>
        inSquad(scope, d.squad.id) &&
        inPeriod(scope, d.lastActivityAt) &&
        (!f.repoId || d.repo.id === f.repoId) &&
        (!f.status || STATUS_GROUP[d.status] === f.status) &&
        (!f.initiativeId || (f.initiativeId === 'none' ? d.initiative === null : d.initiative?.id === f.initiativeId)) &&
        (!f.environment || d.environments.includes(f.environment)) &&
        (!text ||
          [d.cr.title, d.cr.productSummary ?? '', d.repo.name, d.initiative?.name ?? '', `#${d.cr.number}`]
            .join(' ')
            .toLowerCase()
            .includes(text)),
    )
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}
