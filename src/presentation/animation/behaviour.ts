import type { ID } from '@domain/entities';
import type { FigureLayout, Vec2, WorldModel } from '../world/worldModel';
import type { Script, Step } from './script';

/**
 * What the data says about a person in the current scope. Behaviour is
 * illustrative: it mirrors *where* work happened, never presence, workload or
 * performance.
 */
export interface ActivityFacts {
  /** Repos with open change requests authored by the person. */
  authoringRepoIds: ID[];
  /** Repos where the person reviewed changes in the period. */
  reviewingRepoIds: ID[];
  /** Took part in a change confirmed in production recently. */
  celebrates: boolean;
}

const AISLE_Z = 1.1;

/** Walks out from behind the desk through the gap, then along the aisle. */
function routeTo(home: Vec2, target: Vec2): Step[] {
  const side: Vec2 = [home[0] + 1.3, home[1]];
  return [
    { action: 'walk', to: side },
    { action: 'walk', to: [side[0], AISLE_Z] },
    { action: 'walk', to: [target[0], AISLE_Z] },
    { action: 'walk', to: target },
  ];
}

function routeHome(from: Vec2, home: Vec2): Step[] {
  const side: Vec2 = [home[0] + 1.3, home[1]];
  return [
    { action: 'walk', to: [from[0], AISLE_Z] },
    { action: 'walk', to: [side[0], AISLE_Z] },
    { action: 'walk', to: side },
    { action: 'walk', to: home },
  ];
}

const deskFace = (f: FigureLayout): Vec2 => [f.desk[0], f.desk[1] - 1];

/** Small deterministic hash → seconds offset, so figures never move in lockstep. */
function offsetFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 37;
}

export function planBehaviour(figure: FigureLayout, facts: ActivityFacts, world: WorldModel): Script {
  const rackFor = (repoId: ID) => world.racks.find((r) => r.repoId === repoId);
  const sector = world.sectors.find((s) => s.squadId === figure.squadId);
  const steps: Step[] = [{ action: 'type', duration: 6, face: deskFace(figure) }];

  const visit = (target: Vec2, face: Vec2, action: 'inspect' | 'tablet' | 'present', duration: number) => {
    steps.push(...routeTo(figure.home, target), { action, duration, face }, ...routeHome(target, figure.home));
  };

  const authoring = facts.authoringRepoIds.map(rackFor).find(Boolean);
  const reviewing = facts.reviewingRepoIds.map(rackFor).find(Boolean);

  if (figure.role === 'product-manager' && sector) {
    const board = sector.boards.deliveries;
    visit([board[0], board[1] + 1.6], board, 'present', 7);
  } else if (figure.role === 'tech-lead' && sector) {
    const board = sector.boards.changes;
    visit([board[0], board[1] + 1.6], board, 'tablet', 6);
  } else if (authoring) {
    visit(authoring.servicePoint, authoring.position, 'inspect', 7);
  } else if (reviewing) {
    visit(reviewing.servicePoint, reviewing.position, 'tablet', 6);
  }

  if (facts.celebrates) steps.push({ action: 'celebrate', duration: 2.4, face: [figure.home[0], figure.home[1] + 3] });
  steps.push({ action: 'idle', duration: 4, face: deskFace(figure) });

  return { start: figure.home, steps, offset: offsetFor(figure.personId) };
}
