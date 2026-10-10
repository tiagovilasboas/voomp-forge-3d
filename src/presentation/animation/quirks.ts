import type { Action } from './script';

/**
 * Cosmetic personality quirks. They are deliberately NOT derived from data and
 * they rotate over time, so no person is ever permanently shown as "grumpy" or
 * "clumsy" — a robot's mood says nothing about the human behind it.
 */
export type Quirk = 'stumble' | 'glitch' | 'sigh' | 'cheer';

export interface QuirkOffsets {
  bodyPitch: number;
  bodyRoll: number;
  headRoll: number;
  headYaw: number;
  /** Added to both arms' swing (negative = raise forward). */
  armLift: number;
  bob: number;
}

export const NO_QUIRK: QuirkOffsets = { bodyPitch: 0, bodyRoll: 0, headRoll: 0, headYaw: 0, armLift: 0, bob: 0 };

/** A quirk window opens every WINDOW seconds per robot; it plays for DURATION seconds. */
const WINDOW = 17;
const DURATION = 1.8;
/** Roughly 1 in 2 windows actually plays something: keeps the room calm. */
const PLAY_RATIO = 0.5;

function hash(seed: string, n: number): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Which quirk (if any) a robot is playing at `time`, and its progress 0..1. */
export function quirkAt(personId: string, time: number, action: Action): { quirk: Quirk; t: number } | null {
  const offset = hash(personId, 7) * WINDOW;
  const local = time + offset;
  const window = Math.floor(local / WINDOW);
  const into = local - window * WINDOW;
  if (into > DURATION || hash(personId, window) > PLAY_RATIO) return null;
  // Stumbles only make sense while walking; standing robots pick a calm quirk instead.
  const pool: Quirk[] = action === 'walk' ? ['stumble', 'glitch', 'cheer'] : ['glitch', 'sigh', 'cheer'];
  const quirk = pool[Math.floor(hash(personId, window * 31 + 3) * pool.length) % pool.length];
  return { quirk, t: into / DURATION };
}

/** Bell curve 0→1→0 so every quirk eases in and out. */
const ease = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));

export function quirkOffsets(q: { quirk: Quirk; t: number } | null): QuirkOffsets {
  if (!q) return NO_QUIRK;
  const k = ease(q.t);
  switch (q.quirk) {
    case 'stumble': {
      // Quick forward lurch, arms flail out, then recover.
      const lurch = q.t < 0.35 ? ease(q.t / 0.35) : ease(0.5 + (q.t - 0.35) / 1.3) * 0.4;
      return { ...NO_QUIRK, bodyPitch: 0.32 * lurch, armLift: -0.9 * lurch, bob: -0.03 * lurch };
    }
    case 'glitch':
      // Head tilts and freezes for a beat, with a tiny jitter — a "tilted" robot.
      return { ...NO_QUIRK, headRoll: 0.38 * k + Math.sin(q.t * 90) * 0.02 * k, bodyRoll: 0.05 * k };
    case 'sigh':
      // Shoulders drop, head lowers and shakes slowly: complaining about life.
      return { ...NO_QUIRK, headRoll: 0, headYaw: Math.sin(q.t * Math.PI * 4) * 0.25 * k, bodyPitch: 0.08 * k, armLift: 0.12 * k, bob: -0.025 * k };
    case 'cheer':
      // Two small happy hops with a side-to-side head wiggle.
      return { ...NO_QUIRK, bob: Math.abs(Math.sin(q.t * Math.PI * 2)) * 0.06 * k, headRoll: Math.sin(q.t * Math.PI * 4) * 0.18 * k, armLift: -0.35 * k };
  }
}
