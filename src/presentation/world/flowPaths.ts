import type { DeliveryEventKind } from '@application/queries/events';
import type { Vec2, WorldModel } from './worldModel';

/**
 * Route of a light flow on the floor, from a rack to where the event "lands":
 *  merged              → rack to the shared corridor (integrated into the main line)
 *  deployed_staging    → rack to the staging dock
 *  deployed_production → rack to the production gate
 * Pipeline failures do not travel: they stay as an alert on the rack.
 */
export function flowPath(world: WorldModel, repoId: string, kind: DeliveryEventKind): Vec2[] | null {
  if (kind === 'pipeline_failed') return null;
  const rack = world.racks.find((r) => r.repoId === repoId);
  const sector = rack && world.sectors.find((s) => s.squadId === rack.squadId);
  if (!rack || !sector) return null;

  const [rx, rz] = rack.position;
  const { exitX, aisleZ, laneZ } = sector;
  const base: Vec2[] = [
    [rx, rz + 0.8 * sector.facing],
    [rx, aisleZ],
    [exitX, aisleZ],
    [exitX, laneZ],
  ];
  if (kind === 'merged') return [...base, [exitX + 2.2, laneZ]];
  const target = kind === 'deployed_production' ? world.gate : world.stagingDock;
  return [...base, [target[0], laneZ], target];
}

export function pathLength(path: Vec2[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return len;
}

/** Point at distance fraction `t` (0..1) along the path. */
export function pointAt(path: Vec2[], t: number, totalLength = pathLength(path)): Vec2 {
  let remaining = Math.max(0, Math.min(1, t)) * totalLength;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const seg = Math.hypot(bx - ax, bz - az);
    if (remaining <= seg || i === path.length - 1) {
      const k = seg > 0 ? Math.min(1, remaining / seg) : 0;
      return [ax + (bx - ax) * k, az + (bz - az) * k];
    }
    remaining -= seg;
  }
  return path[path.length - 1];
}
