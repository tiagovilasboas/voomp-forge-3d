import type { Action } from './script';

/** Joint angles (radians) and offsets for a block figure. Pure math, renderer-agnostic. */
export interface RigPose {
  armL: number;
  armR: number;
  /** Sideways arm raise (celebrate). */
  armSpread: number;
  legL: number;
  legR: number;
  bob: number;
  headPitch: number;
  /** Accessory visible in hand. */
  holdsDevice: boolean;
}

const REST: RigPose = { armL: 0, armR: 0, armSpread: 0, legL: 0, legR: 0, bob: 0, headPitch: 0, holdsDevice: false };

/**
 * @param elapsed seconds since the action began
 * @param time    global clock, for ambient motion like breathing
 */
export function rigPose(action: Action, elapsed: number, time: number): RigPose {
  const breathe = Math.sin(time * 1.6) * 0.012;
  switch (action) {
    case 'walk': {
      const s = Math.sin(elapsed * 8.5);
      return { ...REST, armL: s * 0.6, armR: -s * 0.6, legL: -s * 0.7, legR: s * 0.7, bob: Math.abs(Math.cos(elapsed * 8.5)) * 0.05 };
    }
    case 'type': {
      const tap = Math.sin(elapsed * 14) * 0.08;
      return { ...REST, armL: -1.1 + tap, armR: -1.1 - tap, bob: breathe, headPitch: 0.18, holdsDevice: true };
    }
    case 'inspect': {
      const reach = Math.sin(elapsed * 1.4) * 0.25;
      return { ...REST, armR: -1.9 + reach, armL: -0.3, bob: breathe, headPitch: -0.12 };
    }
    case 'tablet':
      return { ...REST, armL: -1.25, armR: -1.25, bob: breathe, headPitch: 0.32, holdsDevice: true };
    case 'present': {
      const gesture = Math.sin(elapsed * 2.2) * 0.35;
      return { ...REST, armR: -1.5 + gesture, armL: -0.9, bob: breathe, headPitch: -0.08, holdsDevice: true };
    }
    case 'celebrate': {
      const hop = Math.max(0, Math.sin(elapsed * 7));
      return { ...REST, armL: -2.8, armR: -2.8, armSpread: 0.35, bob: hop * 0.18, headPitch: -0.2 };
    }
    case 'idle':
    default:
      return { ...REST, armL: 0.04, armR: -0.04, bob: breathe };
  }
}
