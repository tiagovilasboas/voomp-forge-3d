import { useMemo } from 'react';
import { computeKpis } from '@application/queries/kpis';
import { listEvents } from '@application/queries/events';
import { repositoryHealth, type RepositoryHealth } from '@application/queries/repositoryHealth';
import { personSummary } from '@application/queries/summaries';
import type { ScopeFilter } from '@application/queries/period';
import { withinHours } from '@application/queries/period';
import { useReadyData } from './dataStore';
import { useUiStore } from './uiStore';
import { planBehaviour } from '../animation/behaviour';
import { compile, type CompiledScript } from '../animation/script';

/**
 * React bindings between the UI state and application queries.
 * "Now" is the snapshot generation time, so every number is reproducible.
 */
export function useScope(): ScopeFilter {
  const { snapshot } = useReadyData();
  const periodDays = useUiStore((s) => s.periodDays);
  const squadId = useUiStore((s) => s.squadId);
  return useMemo(() => ({ periodDays, squadId, now: new Date(snapshot.source.generatedAt) }), [periodDays, squadId, snapshot]);
}

export function useKpis() {
  const { index } = useReadyData();
  const scope = useScope();
  return useMemo(() => computeKpis(index, scope), [index, scope]);
}

export function useEvents() {
  const { index } = useReadyData();
  const scope = useScope();
  return useMemo(() => listEvents(index, scope), [index, scope]);
}

/** Health per repository. Uses the period but not the squad filter: the world always shows every rack. */
export function useRepoHealth(): Map<string, RepositoryHealth> {
  const { index, snapshot } = useReadyData();
  const scope = useScope();
  return useMemo(() => {
    const unscoped = { ...scope, squadId: null };
    return new Map(snapshot.repositories.map((r) => [r.id, repositoryHealth(index, r.id, unscoped)]));
  }, [index, snapshot, scope]);
}

/** Behaviour scripts for every figure, derived from where each person worked in the period. */
export function useFigureScripts(): Map<string, CompiledScript> {
  const { index, world } = useReadyData();
  const scope = useScope();
  return useMemo(() => {
    const unscoped = { ...scope, squadId: null };
    return new Map(
      world.figures.map((figure) => {
        const summary = personSummary(index, figure.personId, unscoped);
        const script = planBehaviour(
          figure,
          {
            authoringRepoIds: summary.authored.filter((d) => d.cr.state === 'open').map((d) => d.repo.id),
            reviewingRepoIds: summary.reviewedDeliveries.map((d) => d.repo.id),
            celebrates: summary.productionParticipation.some((d) =>
              d.stages.some((s) => s.id === 'production' && withinHours(scope.now, s.at, 24 * 7)),
            ),
          },
          world,
        );
        return [figure.personId, { ...compile(script), offset: script.offset }];
      }),
    );
  }, [index, world, scope]);
}
