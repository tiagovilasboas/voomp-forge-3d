import type { Contributor, Repository, Squad } from '@domain/entities';
import { LAYOUT, themeFor } from '@config/world';
import { toWorld, type Facing } from './frame';
import type { EntityRef, FigureLayout, FocusTarget, RackLayout, SectorLayout, Vec2, WorldModel } from './worldModel';

/** Half-width of the production plaza along the corridor; the world is never narrower than this. */
const PLAZA_HALF_WIDTH = 20;

interface Room {
  kind: 'hub' | 'squad';
  /** Original squad index (-1 for the Hub IA); keeps rows ordered like the data. */
  order: number;
  squad?: Squad;
  width: number;
}

/**
 * Entity registry: turns squads, repositories and people into a spatial layout.
 * Pure and deterministic — adding a squad or repository to the data adds a
 * sector or rack without touching any scene code.
 */
export function buildWorld(squads: Squad[], repositories: Repository[], people: Contributor[]): WorldModel {
  const depth = LAYOUT.sectorDepth;
  const gap = LAYOUT.sectorGap;
  const widthOf = (s: Squad) => {
    const racks = repositories.filter((r) => r.squadId === s.id).length;
    const desks = people.filter((p) => p.squadId === s.id).length;
    return Math.max(LAYOUT.sectorMinWidth, racks * LAYOUT.rackSpacing + 8, desks * LAYOUT.deskSpacing + 9);
  };

  // Rooms = Hub IA + every squad. Two rows facing each other across the corridor, balanced by width.
  const rooms: Room[] = [{ kind: 'hub', order: -1, width: LAYOUT.hubWidth }, ...squads.map((squad, order): Room => ({ kind: 'squad', order, squad, width: widthOf(squad) }))];
  const rowWidth = (row: Room[]) => row.reduce((a, r) => a + r.width, 0) + gap * Math.max(0, row.length - 1);
  const north: Room[] = [rooms[0]];
  const south: Room[] = [];
  [...rooms.slice(1)]
    .sort((a, b) => b.width - a.width || a.order - b.order)
    .forEach((room) => (rowWidth(north) < rowWidth(south) ? north : south).push(room));
  north.sort((a, b) => a.order - b.order);
  south.sort((a, b) => a.order - b.order);

  const sectors: SectorLayout[] = [];
  const racks: RackLayout[] = [];
  const figures: FigureLayout[] = [];
  let aiHub!: WorldModel['aiHub'];
  let knowledgeVault: Vec2 = [0, 0];
  const corridorZ = LAYOUT.corridorZ;

  const placeRow = (row: Room[], facing: Facing) => {
    const cz = corridorZ - facing * (LAYOUT.corridorWidth / 2 + depth / 2);
    let cursor = -rowWidth(row) / 2;
    for (const room of row) {
      const width = room.width;
      const center: Vec2 = [cursor + width / 2, cz];
      cursor += width + gap;
      const at = (local: Vec2) => toWorld(center, facing, local);

      if (room.kind === 'hub') {
        aiHub = { center, size: [width, depth], facing, terminal: at([-4.5, 3.6]), pinball: at([4.5, 3.6]), automation: at([-5.6, -4.8]) };
        knowledgeVault = at([0, -2.2]);
        continue;
      }

      const squad = room.squad!;
      sectors.push({
        squadId: squad.id,
        code: squad.code,
        name: squad.name,
        theme: themeFor(squad.id, room.order),
        center,
        size: [width, depth],
        facing,
        aisleZ: at([0, 1.1])[1],
        exitX: at([-width / 2 + 0.7, 0])[0],
        laneZ: corridorZ - facing * LAYOUT.laneOffset,
        boards: { changes: at([-width * 0.27, -depth / 2 + 1.1]), deliveries: at([width * 0.27, -depth / 2 + 1.1]) },
        feature: at([width / 2 - 3.4, 3.6]),
      });

      const repos = repositories.filter((r) => r.squadId === squad.id);
      repos.forEach((repo, i) => {
        const lx = (i - (repos.length - 1) / 2) * LAYOUT.rackSpacing;
        racks.push({ repoId: repo.id, squadId: squad.id, facing, position: at([lx, -2.2]), servicePoint: at([lx, -0.7]) });
      });

      const members = people.filter((p) => p.squadId === squad.id);
      members.forEach((person, i) => {
        const lx = -2.6 + (i - (members.length - 1) / 2) * LAYOUT.deskSpacing;
        figures.push({ personId: person.id, squadId: squad.id, facing, role: person.role, desk: at([lx, 3.4]), home: at([lx, 4.4]) });
      });
    }
  };
  placeRow(north, 1);
  placeRow(south, -1);

  // Production plaza in the middle of the corridor; nothing leaves its band.
  const plaza = (x: number, dz = 0): Vec2 => [x, corridorZ + dz];
  const halfX = Math.max(rowWidth(north) / 2, rowWidth(south) / 2, PLAZA_HALF_WIDTH) + LAYOUT.margin;
  const halfZ = LAYOUT.corridorWidth / 2 + depth + LAYOUT.margin;
  return {
    sectors,
    racks,
    figures,
    corridorZ,
    gate: plaza(3.5),
    stagingDock: plaza(-5.5),
    weekBoard: plaza(10.5, -0.4),
    creditPlaque: plaza(-11.5, 0.6),
    frontsWall: plaza(17, -0.2),
    calendarWall: plaza(-17, -0.2),
    aiHub,
    knowledgeVault,
    bounds: { min: [-halfX, corridorZ - halfZ], max: [halfX, corridorZ + halfZ] },
  };
}

/** Where the camera should look for a given entity. Null when it has no place in the world. */
export function focusFor(world: WorldModel, ref: EntityRef): FocusTarget | null {
  switch (ref.kind) {
    case 'squad': {
      const s = world.sectors.find((x) => x.squadId === ref.id);
      return s ? { center: [s.center[0], s.center[1] + s.facing], radius: Math.max(s.size[0], s.size[1]) * 0.55 } : null;
    }
    case 'repo': {
      const r = world.racks.find((x) => x.repoId === ref.id);
      return r ? { center: [r.position[0], r.position[1] + 1.2 * r.facing], radius: 6.5 } : null;
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
      return { center: [world.aiHub.center[0], world.aiHub.center[1] + world.aiHub.facing], radius: Math.max(...world.aiHub.size) * 0.55 };
    case 'fronts':
      return { center: world.frontsWall, radius: 5 };
    case 'calendar':
      return { center: world.calendarWall, radius: 4.5 };
    case 'workstream':
      return { center: world.frontsWall, radius: 5 };
    case 'terminal':
      return { center: world.aiHub.terminal, radius: 3.5 };
    case 'pinball':
      return { center: world.aiHub.pinball, radius: 3.5 };
    case 'automation':
      return { center: world.aiHub.automation, radius: 3.5 };
    case 'whiteboard':
      return { center: world.weekBoard, radius: 4.5 };
    case 'board': {
      const [squadId, which] = ref.id.split(':');
      const s = world.sectors.find((x) => x.squadId === squadId);
      if (!s) return null;
      const p = which === 'deliveries' ? s.boards.deliveries : s.boards.changes;
      return { center: [p[0], p[1] + 1.5 * s.facing], radius: 4 };
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
  const center: Vec2 = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2 + 1.2 * racks[0].facing];
  const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  return { center, radius: Math.max(6.5, spread * 0.6 + 4) };
}

/** Default view azimuth / polar (CameraRig) — the overview radius accounts for the isometric projection. */
const VIEW_AZIMUTH = 0.62;
const VIEW_POLAR = 0.98;

export function overviewFocus(world: WorldModel): FocusTarget {
  const { min, max } = world.bounds;
  const w = max[0] - min[0];
  const d = max[1] - min[1];
  const center: Vec2 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
  // On screen the footprint spans w·cos + d·sin horizontally; depth is foreshortened by cos(polar).
  const screenW = w * Math.cos(VIEW_AZIMUTH) + d * Math.sin(VIEW_AZIMUTH);
  const screenH = (w * Math.sin(VIEW_AZIMUTH) + d * Math.cos(VIEW_AZIMUTH)) * Math.cos(VIEW_POLAR);
  return { center, radius: Math.max(screenW * 0.34, screenH * 0.55) };
}
