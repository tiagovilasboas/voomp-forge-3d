import type { Action } from './script';
import type { Quirk } from './quirks';

export type Expression = 'neutral' | 'blink' | 'happy' | 'focused' | 'sad' | 'glitch';

const BLINK_EVERY = 4.6;
const BLINK_FOR = 0.14;

/**
 * Face shown on the robot's screen. Driven by what the robot is doing (action)
 * and by its cosmetic quirk — never by data about the person.
 */
export function expressionFor(action: Action, quirk: Quirk | null, time: number, seed: number): Expression {
  if (quirk === 'cheer' || action === 'celebrate') return 'happy';
  if (quirk === 'sigh') return 'sad';
  if (quirk === 'glitch' || quirk === 'stumble') return 'glitch';
  if ((time + seed) % BLINK_EVERY < BLINK_FOR) return 'blink';
  if (action === 'type' || action === 'inspect' || action === 'tablet') return 'focused';
  return 'neutral';
}
