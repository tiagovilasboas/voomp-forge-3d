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
import { KnowledgeVault } from './entities/KnowledgeVault';
import { FrontsWall } from './entities/FrontsWall';
import { CalendarWall } from './entities/CalendarWall';
import { AiHubRoom } from './entities/AiHubRoom';
import { InfoTotem } from './entities/holoProps';
import { RepoHologram } from './holo/RepoHologram';
import { yawFor } from '../world/frame';
import { LAYOUT } from '@config/world';

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
  /** Documents linked to the current focus; null = nothing in focus. */
  const litDocIds = useMemo(() => {
    const ids = (docs: { id: string }[] | undefined) => (docs ?? []).map((d) => d.id);
    if (!selection) {
      return highlightInitiativeId ? new Set(ids(index.docsByInitiative.get(highlightInitiativeId))) : null;
    }
    switch (selection.kind) {
      case 'document':
        return new Set([selection.id]);
      case 'initiative':
        return new Set(ids(index.docsByInitiative.get(selection.id)));
      case 'repo':
        return new Set(ids(index.docsByRepo.get(selection.id)));
      case 'squad':
        return new Set(ids(index.docsBySquad.get(selection.id)));
      case 'cr': {
        const cr = index.cr.get(selection.id);
        if (!cr) return null;
        return new Set([...ids(index.docsByRepo.get(cr.repositoryId)), ...ids(cr.initiativeId ? index.docsByInitiative.get(cr.initiativeId) : undefined)]);
      }
      default:
        return null;
    }
  }, [selection, highlightInitiativeId, index]);
  const squadAlert = useMemo(() => {
    const set = new Set<string>();
    for (const r of world.racks) if (health.get(r.repoId)?.alert) set.add(r.squadId);
    return set;
  }, [world, health]);
  /** One info totem per sector, on the corridor edge in front of its room. */
  const totems = useMemo(
    () =>
      world.sectors.map((s) => ({
        code: s.code,
        name: s.name,
        accent: s.theme.accent,
        position: [s.center[0], 2.3, world.corridorZ - s.facing * (LAYOUT.corridorWidth / 2 - 0.6)] as [number, number, number],
      })),
    [world],
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
          alert={squadAlert.has(s.squadId)}
          reducedMotion={reducedMotion}
        />
      ))}

      {totems.map((t) => (
        <InfoTotem key={t.code} position={t.position} code={t.code} name={t.name} accent={t.accent} reducedMotion={reducedMotion} />
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
      <FrontsWall position={world.frontsWall} reducedMotion={reducedMotion} />
      <CalendarWall position={world.calendarWall} reducedMotion={reducedMotion} />
      <AiHubRoom world={world} reducedMotion={reducedMotion} />
      <group position={[0, PLATFORM_H, 0]}>
        <KnowledgeVault position={world.knowledgeVault} yaw={yawFor(world.aiHub.facing)} documents={snapshot.documents} litDocIds={litDocIds} racks={world.racks} reducedMotion={reducedMotion} />
      </group>
      <CreditPlaque position={world.creditPlaque} />
      <RepoHologram />
      {/* snapshot marker for debugging in devtools */}
      <group name={`forge:${snapshot.source.kind}`} />
    </>
  );
}
