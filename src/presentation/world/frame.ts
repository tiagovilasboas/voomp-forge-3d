import type { Vec2 } from './worldModel';

/** 1 = the room's open front looks toward +z; -1 = the room is rotated 180° (front toward -z). */
export type Facing = 1 | -1;

/** Y rotation (radians) of a room group for a facing. */
export const yawFor = (facing: Facing): number => (facing < 0 ? Math.PI : 0);

/**
 * Room-local offset (from the room centre, front toward +z) → world point.
 * A 180° turn is its own inverse, so this also maps world → local.
 */
export function toWorld(center: Vec2, facing: Facing, local: Vec2): Vec2 {
  return [center[0] + local[0] * facing, center[1] + local[1] * facing];
}
