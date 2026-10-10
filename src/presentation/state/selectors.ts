import { useMemo } from 'react';
import { computeKpis } from '@application/queries/kpis';
import { listEvents } from '@application/queries/events';
import { repositoryHealth, type RepositoryHealth } from '@application/queries/repositoryHealth';
import { personSummary } from '@application/queries/summaries';
import type { ScopeFilter } from '@application/queries/period';
import { withinHours } from '@application/queries/period';
import type { Deployment } from '@domain/entities';
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

const RIDE_WINDOW_HOURS = 48;

/**
 * Who rides to the production gate: the person who triggered the latest
 * production deployment, if it is running or succeeded within 48h. Unknown
 * trigger or failure → no entry (never invent who deployed).
 */
export function productionRides(deployments: Deployment[], now: Date): Map<string, 'deploying' | 'celebrating'> {
  const latest = new Map<string, Deployment>();
  for (const d of deployments) {
    if (d.environment !== 'production' || !d.triggeredById) continue;
    const prev = latest.get(d.triggeredById);
    if (!prev || d.createdAt > prev.createdAt) latest.set(d.triggeredById, d);
  }
  const rides = new Map<string, 'deploying' | 'celebrating'>();
  for (const [personId, d] of latest) {
    if (d.status === 'running') rides.set(personId, 'deploying');
    else if (d.status === 'success' && withinHours(now, d.createdAt, RIDE_WINDOW_HOURS)) rides.set(personId, 'celebrating');
  }
  return rides;
}

/** Behaviour scripts for every figure, derived from where each person worked in the period. */
export function useFigureScripts(): Map<string, CompiledScript> {
  const { index, world, snapshot } = useReadyData();
  const scope = useScope();
  return useMemo(() => {
    const rides = productionRides(snapshot.deployments, scope.now);
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
            ride: rides.get(figure.personId) ?? null,
          },
          world,
        );
        return [figure.personId, { ...compile(script), offset: script.offset }];
      }),
    );
  }, [index, world, snapshot, scope]);
}
