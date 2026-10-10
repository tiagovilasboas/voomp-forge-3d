import { describe, expect, it } from 'vitest';
import { NO_QUIRK, quirkAt, quirkOffsets } from './quirks';

const people = ['ct-iara-v', 'ct-otavio-b', 'ct-zelia-k', 'ct-bento-m', 'ct-maira-t', 'ct-anselmo-j'];

/** Every quirk each person plays over a long stretch of time (sampled once per second). */
function quirksOf(personId: string, seconds = 3000) {
  const seen = new Set<string>();
  for (let t = 0; t < seconds; t++) {
    const q = quirkAt(personId, t, 'idle');
    if (q) seen.add(q.quirk);
  }
  return seen;
}

describe('quirks', () => {
  it('are deterministic', () => {
    expect(quirkAt('ct-iara-v', 123.4, 'idle')).toEqual(quirkAt('ct-iara-v', 123.4, 'idle'));
  });

  it('rotate: no person is stuck with a single mood', () => {
    for (const id of people) expect(quirksOf(id).size).toBeGreaterThanOrEqual(2);
  });

  it('are rare: robots are calm most of the time', () => {
    let playing = 0;
    for (let t = 0; t < 2000; t += 0.5) if (quirkAt('ct-zelia-k', t, 'idle')) playing++;
    expect(playing / 4000).toBeLessThan(0.15);
  });

  it('never stumble while standing still', () => {
    for (let t = 0; t < 3000; t += 0.5) expect(quirkAt('ct-bento-m', t, 'type')?.quirk).not.toBe('stumble');
  });

  it('ease back to the neutral pose at the end of a quirk', () => {
    for (const quirk of ['stumble', 'glitch', 'sigh', 'cheer'] as const) {
      const end = quirkOffsets({ quirk, t: 1 });
      for (const v of Object.values(end)) expect(Math.abs(v)).toBeLessThan(0.05);
    }
    expect(quirkOffsets(null)).toEqual(NO_QUIRK);
  });
});
