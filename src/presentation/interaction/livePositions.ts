import type { Vec2 } from '../world/worldModel';

/**
 * Runtime positions of moving entities (figures), written every frame by the
 * renderer and read by the camera rig to focus or follow. Plain mutable map:
 * no React re-render involved.
 */
export const livePositions = new Map<string, Vec2>();
