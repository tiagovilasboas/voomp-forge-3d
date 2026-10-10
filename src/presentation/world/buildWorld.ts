import type { Contributor, Repository, Squad } from '@domain/entities';
import { LAYOUT, themeFor } from '@config/world';
import type { EntityRef, FigureLayout, FocusTarget, RackLayout, SectorLayout, Vec2, WorldModel } from './worldModel';

/**
 * Entity registry: turns squads, repositories and people into a spatial layout.
 * Pure and deterministic — adding a squad or repository to the data adds a
 * sector or rack without touching any scene code.
 */
export function buildWorld(squads: Squad[], repositories: Repository[], people: Contributor[]): WorldModel {
  const widths = squads.map((s) => {
    const racks = repositories.filter((r) => r.squadId === s.id).length;
    const desks = people.filter((p) => p.squadId === s.id).length;
    return Math.max(LAYOUT.sectorMinWidth, racks * LAYOUT.rackSpacing + 8, desks * LAYOUT.deskSpacing + 9);
  });
  const total = widths.reduce((a, b) => a + b, 0) + LAYOUT.sectorGap * Math.max(0, squads.length - 1);

  const sectors: SectorLayout[] = [];
  const racks: RackLayout[] = [];
  const figures: FigureLayout[] = [];
  const depth = LAYOUT.sectorDepth;
  let cursor = -total / 2;

  squads.forEach((squad, order) => {
    const width = widths[order];
    const cx = cursor + width / 2;
    cursor += width + LAYOUT.sectorGap;

    sectors.push({
      squadId: squad.id,
      code: squad.code,
      name: squad.name,
      theme: themeFor(squad.id, order),
      center: [cx, 0],
      size: [width, depth],
      boards: { changes: [cx - width * 0.27, -depth / 2 + 1.1], deliveries: [cx + width * 0.27, -depth / 2 + 1.1] },
      feature: [cx + width / 2 - 3.4, 3.6],
    });

    const repos = repositories.filter((r) => r.squadId === squad.id);
    repos.forEach((repo, i) => {
      const x = cx + (i - (repos.length - 1) / 2) * LAYOUT.rackSpacing;
      racks.push({ repoId: repo.id, squadId: squad.id, position: [x, -2.2], servicePoint: [x, -0.7] });
    });

    const members = people.filter((p) => p.squadId === squad.id);
    const deskCenter = cx - 2.6;
    members.forEach((person, i) => {
      const x = deskCenter + (i - (members.length - 1) / 2) * LAYOUT.deskSpacing;
      figures.push({ personId: person.id, squadId: squad.id, role: person.role, desk: [x, 3.4], home: [x, 4.4] });
    });
  });

  // Hub IA sits to the left of the first sector, sharing the corridor.
  const hubSize: Vec2 = [16, depth];
  const hubCenter: Vec2 = [-total / 2 - LAYOUT.sectorGap - hubSize[0] / 2, 0];
  const half = total / 2 + 3;
  const minX = hubCenter[0] - hubSize[0] / 2 - 3;
  return {
    sectors,
    racks,
    figures,
    corridorZ: LAYOUT.corridorZ,
    gate: [3.5, LAYOUT.gateZ],
    stagingDock: [-5.5, LAYOUT.gateZ],
    weekBoard: [10.5, LAYOUT.gateZ - 0.4],
    creditPlaque: [-12, LAYOUT.gateZ + 0.6],
    aiHub: {
      center: hubCenter,
      size: hubSize,
      terminal: [hubCenter[0] - 4.5, 3.6],
      pinball: [hubCenter[0] + 4.5, 3.6],
    },
    knowledgeVault: [hubCenter[0], -2.2],
    bounds: { min: [minX, -depth / 2 - 3], max: [half, LAYOUT.gateZ + 4] },
  };
}

/** Where the camera should look for a given entity. Null when it has no place in the world. */
export function focusFor(world: WorldModel, ref: EntityRef): FocusTarget | null {
  switch (ref.kind) {
    case 'squad': {
      const s = world.sectors.find((x) => x.squadId === ref.id);
      return s ? { center: [s.center[0], s.center[1] + 1], radius: Math.max(s.size[0], s.size[1]) * 0.55 } : null;
    }
    case 'repo': {
      const r = world.racks.find((x) => x.repoId === ref.id);
      return r ? { center: [r.position[0], r.position[1] + 1.2], radius: 6.5 } : null;
    }
    case 'person': {
      const f = world.figures.find((x) => x.personId === ref.id);
      return f ? { center: f.home, radius: 5 } : null;
    }
    case 'gate':
      return { center: [(world.gate[0] + world.stagingDock[0]) / 2, world.gate[1]], radius: 7 };
    case 'document':
      return { center: world.knowledgeVault, radius: 6 };
    case 'hub':
      return { center: [world.aiHub.center[0], world.aiHub.center[1] + 1], radius: Math.max(...world.aiHub.size) * 0.55 };
    case 'terminal':
      return { center: world.aiHub.terminal, radius: 3.5 };
    case 'pinball':
      return { center: world.aiHub.pinball, radius: 3.5 };
    case 'whiteboard':
      return { center: world.weekBoard, radius: 4.5 };
    case 'board': {
      const [squadId, which] = ref.id.split(':');
      const s = world.sectors.find((x) => x.squadId === squadId);
      if (!s) return null;
      const p = which === 'deliveries' ? s.boards.deliveries : s.boards.changes;
      return { center: [p[0], p[1] + 1.5], radius: 4 };
    }
    case 'desk': {
      const f = world.figures.find((x) => x.personId === ref.id);
      return f ? { center: f.desk, radius: 3.5 } : null;
    }
    default:
      return null;
  }
}

/** Frames a group of racks (e.g. every repository touched by an initiative). */
export function focusForRepos(world: WorldModel, repoIds: string[]): FocusTarget | null {
  const racks = world.racks.filter((r) => repoIds.includes(r.repoId));
  if (!racks.length) return null;
  const xs = racks.map((r) => r.position[0]);
  const zs = racks.map((r) => r.position[1]);
  const center: Vec2 = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2 + 1.2];
  return { center, radius: Math.max(6.5, (Math.max(...xs) - Math.min(...xs)) * 0.6 + 4) };
}

export function overviewFocus(world: WorldModel): FocusTarget {
  const { min, max } = world.bounds;
  const center: Vec2 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
  // Isometric projection foreshortens depth, so the width dominates the framing.
  return { center, radius: Math.max((max[0] - min[0]) * 0.36, (max[1] - min[1]) * 0.3) };
}
