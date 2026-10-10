import { useMemo } from 'react';
import { listDeliveries, STATUS_GROUP } from '@application/queries/deliveries';
import { useReadyData } from '../state/dataStore';
import { useUiStore } from '../state/uiStore';
import { useNotesStore } from '../state/notesStore';
import { useEvents, useFigureScripts, useRepoHealth, useScope } from '../state/selectors';
import { SectorEntity, type SectorBoards } from './entities/SectorEntity';
import { RackEntity } from './entities/RackEntity';
import { FigureEntity } from './entities/FigureEntity';
import { FlowStreams } from './entities/FlowStreams';
import { ProductionGate } from './entities/ProductionGate';
import { WeekBoard } from './entities/WeekBoard';
import { CreditPlaque } from './entities/CreditPlaque';

const PLATFORM_H = 0.14;

/** Composes the world from data: every object below is derived from the snapshot. */
export function ForgeScene() {
  const { world, index, snapshot } = useReadyData();
  const scope = useScope();
  const health = useRepoHealth();
  const scripts = useFigureScripts();
  const events = useEvents();
  const squadFilter = useUiStore((s) => s.squadId);
  const selection = useUiStore((s) => s.selection);
  const highlightInitiativeId = useUiStore((s) => s.highlightInitiativeId);
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const notes = useNotesStore((s) => s.notes);

  const boards = useMemo(() => {
    const result = new Map<string, SectorBoards>();
    for (const sector of world.sectors) {
      const ds = listDeliveries(index, { ...scope, squadId: sector.squadId });
      const count = (...groups: string[]) => ds.filter((d) => groups.includes(STATUS_GROUP[d.status])).length;
      result.set(sector.squadId, {
        open: ds.filter((d) => d.cr.state === 'open').length,
        awaitingReview: ds.filter((d) => d.status === 'awaiting_review').length,
        blocked: count('blocked'),
        production: count('production'),
        staging: count('staging'),
        integrated: count('integrated'),
      });
    }
    return result;
  }, [world, index, scope]);

  /** Racks related to the current focus: an initiative, a change request or a repo. */
  const focusRepoIds = useMemo(() => {
    if (selection?.kind === 'repo') return new Set([selection.id]);
    if (selection?.kind === 'cr') {
      const cr = index.cr.get(selection.id);
      return cr ? new Set([cr.repositoryId]) : null;
    }
    const initiativeId = selection?.kind === 'initiative' ? selection.id : highlightInitiativeId;
    if (initiativeId) return new Set((index.crsByInitiative.get(initiativeId) ?? []).map((c) => c.repositoryId));
    return null;
  }, [selection, highlightInitiativeId, index]);

  const highlightRacks = selection?.kind === 'repo' ? null : focusRepoIds;
  const gateCounts = useMemo(
    () => ({
      production: events.filter((e) => e.kind === 'deployed_production').length,
      staging: events.filter((e) => e.kind === 'deployed_staging').length,
    }),
    [events],
  );
  /** The whiteboard always shows the last 7 days, across squads. */
  const weekDeliveries = useMemo(
    () => listDeliveries(index, { ...scope, periodDays: 7, squadId: null }, { status: 'production' }),
    [index, scope],
  );
  const dimmedSquad = (squadId: string) => squadFilter !== null && squadFilter !== squadId;

  return (
    <>
      {world.sectors.map((s) => (
        <SectorEntity
          key={s.squadId}
          layout={s}
          racks={world.racks.filter((r) => r.squadId === s.squadId)}
          figures={world.figures.filter((f) => f.squadId === s.squadId)}
          boards={boards.get(s.squadId)!}
          dimmed={dimmedSquad(s.squadId)}
        />
      ))}

      <group position={[0, PLATFORM_H, 0]}>
        {world.racks.map((r) => (
          <RackEntity
            key={r.repoId}
            layout={r}
            repo={index.repo.get(r.repoId)!}
            health={health.get(r.repoId)!}
            highlighted={highlightRacks?.has(r.repoId) ?? false}
            dimmed={dimmedSquad(r.squadId) || (focusRepoIds !== null && !focusRepoIds.has(r.repoId))}
            reducedMotion={reducedMotion}
          />
        ))}
        {world.figures.map((f) => (
          <FigureEntity
            key={f.personId}
            layout={f}
            person={index.person.get(f.personId)!}
            script={scripts.get(f.personId)!}
            dimmed={dimmedSquad(f.squadId)}
            reducedMotion={reducedMotion}
          />
        ))}
      </group>

      <FlowStreams world={world} events={events} focusRepoIds={focusRepoIds} reducedMotion={reducedMotion} />
      <ProductionGate
        gate={world.gate}
        dock={world.stagingDock}
        productionCount={gateCounts.production}
        stagingCount={gateCounts.staging}
        reducedMotion={reducedMotion}
      />
      <WeekBoard position={world.weekBoard} deliveries={weekDeliveries} notes={notes} vocabularyShort={snapshot.source.provider.vocabulary.changeRequestShort} />
      <CreditPlaque position={world.creditPlaque} />
      {/* snapshot marker for debugging in devtools */}
      <group name={`forge:${snapshot.source.kind}`} />
    </>
  );
}
