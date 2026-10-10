import type { ID, ProductInitiative, Repository } from '@domain/entities';
import type { ForgeIndex } from './forgeIndex';
import { listDeliveries, STATUS_GROUP, type Delivery } from './deliveries';
import { type ScopeFilter } from './period';

export interface InitiativeSummary {
  initiative: ProductInitiative;
  deliveries: Delivery[];
  repositories: Repository[];
  inProduction: Delivery[];
  notYetInProduction: Delivery[];
  inReview: Delivery[];
  blocked: Delivery[];
  /** Plain-language sentence for Product. */
  headline: string;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function initiativeSummary(idx: ForgeIndex, initiativeId: ID, scope: ScopeFilter): InitiativeSummary {
  const deliveries = listDeliveries(idx, { ...scope, squadId: null }, { initiativeId });
  const by = (...groups: string[]) => deliveries.filter((d) => groups.includes(STATUS_GROUP[d.status]));
  const inProduction = by('production');
  const notYetInProduction = by('staging', 'integrated');
  const inReview = by('review', 'draft');
  const blocked = by('blocked');
  const repositories = [...new Map(deliveries.map((d) => [d.repo.id, d.repo])).values()];

  const parts: string[] = [];
  if (inProduction.length) parts.push(`${plural(inProduction.length, 'mudança chegou', 'mudanças chegaram')} à produção`);
  if (notYetInProduction.length) parts.push(`${plural(notYetInProduction.length, 'está integrada', 'estão integradas')} mas ainda não em produção`);
  if (inReview.length) parts.push(`${plural(inReview.length, 'aguarda', 'aguardam')} revisão ou finalização`);
  if (blocked.length) parts.push(`${plural(blocked.length, 'está bloqueada', 'estão bloqueadas')} por falha técnica ou ajustes pedidos`);

  return {
    initiative: idx.initiative.get(initiativeId)!,
    deliveries,
    repositories,
    inProduction,
    notYetInProduction,
    inReview,
    blocked,
    headline: parts.length
      ? `No período, ${parts.join('; ')}.`
      : 'Nenhuma mudança vinculada a esta iniciativa no período.',
  };
}

export function initiativeSummaries(idx: ForgeIndex, scope: ScopeFilter): InitiativeSummary[] {
  return idx.snapshot.initiatives.map((i) => initiativeSummary(idx, i.id, scope));
}
