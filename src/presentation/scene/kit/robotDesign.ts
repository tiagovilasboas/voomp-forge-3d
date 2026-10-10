/**
 * Deterministic robot design per person: every robot looks different, and the
 * same person always gets the same robot. Pure data — no Three.js here.
 * Sleek humanoid language: glossy shell panels, dark carbon joints, a black
 * glass face with a light band. No skin tones, no gender cues.
 */

export type HeadShape = 'capsule' | 'slim' | 'broad';
export type FaceLight = 'band' | 'dual' | 'split';

export interface Finish {
  shell: string;
  clearcoat: number;
  roughness: number;
}

export interface RobotDesign {
  head: HeadShape;
  face: FaceLight;
  finish: Finish;
  /** 5-light chest signature: a subtle, unique "ID LED" pattern. */
  signature: boolean[];
}

const HEADS: HeadShape[] = ['capsule', 'slim', 'broad'];
const FACES: FaceLight[] = ['band', 'dual', 'split'];
const FINISHES: Finish[] = [
  { shell: '#ECEDEF', clearcoat: 1, roughness: 0.22 }, // pearl white
  { shell: '#2A2D33', clearcoat: 1, roughness: 0.3 }, // graphite
  { shell: '#A9AEB6', clearcoat: 0.8, roughness: 0.28 }, // titanium
  { shell: '#CBBFA8', clearcoat: 0.7, roughness: 0.35 }, // sand
  { shell: '#121418', clearcoat: 0.4, roughness: 0.55 }, // matte black
  { shell: '#D7DADF', clearcoat: 1, roughness: 0.18 }, // silver white
];

function hash(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function robotDesign(personId: string): RobotDesign {
  const pick = <T>(list: T[], salt: number) => list[hash(personId, salt) % list.length];
  const bits = hash(personId, 99);
  const signature = Array.from({ length: 5 }, (_, i) => ((bits >> i) & 1) === 1);
  // Never an all-off signature: it would read as "powered down".
  if (!signature.some(Boolean)) signature[2] = true;
  return { head: pick(HEADS, 1), face: pick(FACES, 3), finish: pick(FINISHES, 4), signature };
}

export const ROLE_TAG: Record<string, string> = {
  developer: 'Dev',
  reviewer: 'Reviewer',
  'tech-lead': 'Tech Lead',
  'product-manager': 'Product',
  unknown: 'Função não informada',
};
