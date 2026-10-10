import type { Vec2 } from '../world/worldModel';

/**
 * Animation system core: a figure runs a looping script of steps. Sampling is
 * a pure function of time, so animations are deterministic, pausable and cheap
 * (no per-frame allocation in the renderer beyond reading the result).
 */

export type Action = 'idle' | 'walk' | 'type' | 'inspect' | 'tablet' | 'present' | 'celebrate' | 'ride';

export type Step =
  | { action: 'walk'; to: Vec2 }
  /** Scooter ride: like a walk, but faster. */
  | { action: 'ride'; to: Vec2 }
  | { action: Exclude<Action, 'walk' | 'ride'>; duration: number; face?: Vec2 };

export interface Script {
  start: Vec2;
  steps: Step[];
  /** Phase offset in seconds so figures don't move in sync. */
  offset: number;
}

export interface Pose {
  position: Vec2;
  /** Yaw in radians (0 = facing +z). */
  heading: number;
  action: Action;
  /** Seconds since the current step started. */
  elapsed: number;
}

const WALK_SPEED = 1.15; // world units per second
const RIDE_SPEED = 3.4;

interface Segment {
  action: Action;
  from: Vec2;
  to: Vec2;
  heading: number;
  start: number;
  duration: number;
}

const headingTo = (from: Vec2, to: Vec2) => Math.atan2(to[0] - from[0], to[1] - from[1]);
const dist = (a: Vec2, b: Vec2) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Pre-computes absolute segments once per script. */
export function compile(script: Script): { segments: Segment[]; length: number } {
  const segments: Segment[] = [];
  let pos = script.start;
  let heading = Math.PI;
  let t = 0;
  for (const step of script.steps) {
    if (step.action === 'walk' || step.action === 'ride') {
      const duration = Math.max(0.01, dist(pos, step.to) / (step.action === 'ride' ? RIDE_SPEED : WALK_SPEED));
      heading = dist(pos, step.to) > 1e-3 ? headingTo(pos, step.to) : heading;
      segments.push({ action: step.action, from: pos, to: step.to, heading, start: t, duration });
      pos = step.to;
      t += duration;
    } else {
      if (step.face) heading = headingTo(pos, step.face);
      segments.push({ action: step.action, from: pos, to: pos, heading, start: t, duration: step.duration });
      t += step.duration;
    }
  }
  return { segments, length: t };
}

export type CompiledScript = ReturnType<typeof compile> & { offset: number };

export function sample(compiled: CompiledScript, time: number): Pose {
  const { segments, length } = compiled;
  if (!segments.length || length <= 0) {
    return { position: [0, 0], heading: 0, action: 'idle', elapsed: time };
  }
  const t = (((time + compiled.offset) % length) + length) % length;
  // Scripts are short (< 12 steps): a linear scan is simpler than a search and just as fast.
  const seg = segments.find((s) => t < s.start + s.duration) ?? segments[segments.length - 1];
  const elapsed = t - seg.start;
  const k = seg.action === 'walk' || seg.action === 'ride' ? Math.min(1, elapsed / seg.duration) : 0;
  return {
    position: [seg.from[0] + (seg.to[0] - seg.from[0]) * k, seg.from[1] + (seg.to[1] - seg.from[1]) * k],
    heading: seg.heading,
    action: seg.action,
    elapsed,
  };
}
