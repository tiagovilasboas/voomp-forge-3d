/**
 * Robot design language (extracted from the art-direction reference as data):
 * chibi proportions, rounded helmet with a black screen face and LED eyes,
 * gunmetal armour with glowing joint rings, chunky boots with light strips.
 *
 * Every robot is unique and deterministic per person. Pure data — no Three.js.
 */

export const ROBOT_STYLE = {
  proportions: { height: 1.32, headRadius: 0.27, torso: [0.36, 0.32, 0.26], hipY: 0.42 },
  /** LED eyes on the face screen. Cyan is reserved for robots: no status uses it. */
  eyeColor: '#38E1FF',
  ringSecondary: '#38BDF8',
  faceScreen: '#050608',
} as const;

export type EarStyle = 'ring' | 'fin' | 'pod';

export interface Finish {
  shell: string;
  metalness: number;
  roughness: number;
}

export interface RobotDesign {
  ear: EarStyle;
  finish: Finish;
  /** Helmet crest stripe on top of the head. */
  crest: boolean;
  /** 5-light chest signature: a subtle, unique "ID LED" pattern. */
  signature: boolean[];
}

const EARS: EarStyle[] = ['ring', 'fin', 'pod'];
const FINISHES: Finish[] = [
  { shell: '#2E3138', metalness: 0.75, roughness: 0.38 }, // gunmetal
  { shell: '#1C1E23', metalness: 0.6, roughness: 0.45 }, // graphite
  { shell: '#4A4E57', metalness: 0.8, roughness: 0.32 }, // steel
  { shell: '#D9DBDF', metalness: 0.35, roughness: 0.3 }, // pearl
  { shell: '#5B5145', metalness: 0.7, roughness: 0.4 }, // bronze
  { shell: '#3B3F4A', metalness: 0.7, roughness: 0.5 }, // slate
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
  return { ear: pick(EARS, 1), finish: pick(FINISHES, 4), crest: hash(personId, 5) % 2 === 0, signature };
}

export const ROLE_TAG: Record<string, string> = {
  developer: 'Dev',
  reviewer: 'Reviewer',
  'tech-lead': 'Tech Lead',
  'product-manager': 'Product',
  unknown: 'Função não informada',
};
