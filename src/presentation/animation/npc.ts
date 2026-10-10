import type { Vec2, WorldModel } from '../world/worldModel';
import type { Script, Step } from './script';

/** Yaw (radians) of the n8n desk in the hub; the front of the desk looks toward (sin, cos). */
export const AUTOMATION_YAW = 0.35;
/** Distance from the desk centre to where the bot stands. */
const STAND_DISTANCE = 1.7;

type Hub = WorldModel['aiHub'];

/** Where someone stands to face the n8n desk. */
export function automationStand(hub: Hub): Vec2 {
  const [x, z] = hub.automation;
  return [x + Math.sin(AUTOMATION_YAW) * STAND_DISTANCE, z + Math.cos(AUTOMATION_YAW) * STAND_DISTANCE];
}

/**
 * "Forge Bot" patrol: an NPC (not a contributor) that inspects the n8n desk, then
 * walks a loop around the vault, pinball and terminal before returning. Pure and
 * deterministic; every waypoint stays inside the hub.
 */
export function planNpcPatrol(hub: Hub): Script {
  const [cx, cz] = hub.center;
  const stand = automationStand(hub);
  const lane: Vec2 = [cx - 4.2, cz + 1.0]; // clear of the vault, heading east
  const aroundVault: Vec2 = [cx + 3.8, cz + 1.0];
  const nearPinball: Vec2 = [hub.pinball[0] - 1.5, hub.pinball[1] - 1.7];
  const nearTerminal: Vec2 = [hub.terminal[0] + 1.5, hub.terminal[1] - 1.7];
  const steps: Step[] = [
    { action: 'inspect', duration: 4, face: hub.automation },
    { action: 'tablet', duration: 3, face: hub.automation },
    { action: 'walk', to: lane },
    { action: 'walk', to: aroundVault },
    { action: 'idle', duration: 1.5, face: hub.center },
    { action: 'walk', to: nearPinball },
    { action: 'idle', duration: 1.5, face: hub.pinball },
    { action: 'walk', to: nearTerminal },
    { action: 'idle', duration: 1.5, face: hub.terminal },
    { action: 'walk', to: lane },
    { action: 'walk', to: stand },
  ];
  return { start: stand, steps, offset: 0 };
}
