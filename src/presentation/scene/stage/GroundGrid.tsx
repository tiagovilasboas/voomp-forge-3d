import { useEffect, useMemo } from 'react';
import { LAYOUT } from '@config/world';
import type { WorldModel } from '../../world/worldModel';
import { makeGroundGridTexture } from '../kit/canvasTexture';

/** World units per grid cell. Half the sector depth keeps the horizon grid in
 * step with the room rhythm without crowding the floor with lines. */
const CELL = LAYOUT.sectorDepth / 2;

/**
 * The infinite-feeling floor beneath the rooms: a wide square plane with a grid
 * that fades radially to nothing, so the scene dissolves into the fog instead
 * of ending at a hard edge. Static (never animates), so `reducedMotion` is
 * irrelevant. Sits a hair below the room floors to avoid z-fighting.
 */
export function GroundGrid({ world }: { world: WorldModel }) {
  const { min, max } = world.bounds;

  // Size the plane as a whole number of cells around the world centre, so the
  // grid lines land on the same rhythm as the rooms (which align to LAYOUT).
  const span = Math.max(max[0] - min[0], max[1] - min[1]) + 240;
  const cells = Math.ceil(span / CELL);
  const size = cells * CELL;
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[1] + max[1]) / 2;

  const tex = useMemo(() => makeGroundGridTexture(cells), [cells]);
  useEffect(() => () => tex.dispose(), [tex]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, cz]} renderOrder={-1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} opacity={0.5} />
    </mesh>
  );
}
