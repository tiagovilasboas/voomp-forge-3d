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

  const half = total / 2 + 3;
  return {
    sectors,
    racks,
    figures,
    corridorZ: LAYOUT.corridorZ,
    gate: [3.5, LAYOUT.gateZ],
    stagingDock: [-5.5, LAYOUT.gateZ],
    bounds: { min: [-half, -depth / 2 - 3], max: [half, LAYOUT.gateZ + 4] },
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
    default:
      return null;
  }
}

export function overviewFocus(world: WorldModel): FocusTarget {
  const { min, max } = world.bounds;
  const center: Vec2 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
  // Isometric projection foreshortens depth, so the width dominates the framing.
  return { center, radius: Math.max((max[0] - min[0]) * 0.36, (max[1] - min[1]) * 0.3) };
}
