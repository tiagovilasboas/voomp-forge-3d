import type { Contributor, ID, Repository, Review, Squad } from '@domain/entities';
import type { ForgeIndex } from './forgeIndex';
import { listDeliveries, STATUS_GROUP, toDelivery, type Delivery } from './deliveries';
import { computeKpis, type Kpis } from './kpis';
import { inPeriod, type ScopeFilter } from './period';

export interface SquadSummary {
  squad: Squad;
  repositories: Repository[];
  people: Contributor[];
  kpis: Kpis;
  openChanges: number;
  recentDeliveries: Delivery[];
}

export function squadSummary(idx: ForgeIndex, squadId: ID, scope: ScopeFilter): SquadSummary {
  const squadScope = { ...scope, squadId };
  const deliveries = listDeliveries(idx, squadScope);
  return {
    squad: idx.squad.get(squadId)!,
    repositories: idx.reposBySquad.get(squadId) ?? [],
    people: idx.peopleBySquad.get(squadId) ?? [],
    kpis: computeKpis(idx, squadScope),
    openChanges: deliveries.filter((d) => d.cr.state === 'open').length,
    recentDeliveries: deliveries.filter((d) => ['production', 'staging', 'integrated'].includes(STATUS_GROUP[d.status])).slice(0, 6),
  };
}

/**
 * Participation only — never a score, ranking or availability signal.
 */
export interface PersonSummary {
  person: Contributor;
  squad: Squad | null;
  authored: Delivery[];
  reviews: Review[];
  reviewedDeliveries: Delivery[];
  /** Change requests the person authored or reviewed that reached production. */
  productionParticipation: Delivery[];
}

export function personSummary(idx: ForgeIndex, personId: ID, scope: ScopeFilter): PersonSummary {
  const person = idx.person.get(personId)!;
  const authored = (idx.crsByAuthor.get(personId) ?? []).map((cr) => toDelivery(idx, cr)).filter((d) => inPeriod(scope, d.lastActivityAt));
  const reviews = (idx.reviewsByPerson.get(personId) ?? []).filter((r) => inPeriod(scope, r.submittedAt));
  const reviewedIds = [...new Set(reviews.map((r) => r.changeRequestId))];
  const reviewedDeliveries = reviewedIds.map((id) => toDelivery(idx, idx.cr.get(id)!));
  const all = [...authored, ...reviewedDeliveries.filter((d) => !authored.some((a) => a.cr.id === d.cr.id))];
  return {
    person,
    squad: idx.squad.get(person.squadId) ?? null,
    authored,
    reviews,
    reviewedDeliveries,
    productionParticipation: all.filter((d) => d.status === 'in_production'),
  };
}
