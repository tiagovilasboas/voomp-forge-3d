import { describe, expect, it } from 'vitest';
import { expressionFor } from './expression';

describe('expressionFor', () => {
  it('is happy when celebrating or cheering', () => {
    expect(expressionFor('celebrate', null, 1, 0)).toBe('happy');
    expect(expressionFor('idle', 'cheer', 1, 0)).toBe('happy');
  });

  it('follows the cosmetic quirk', () => {
    expect(expressionFor('idle', 'sigh', 1, 0)).toBe('sad');
    expect(expressionFor('walk', 'stumble', 1, 0)).toBe('glitch');
  });

  it('looks focused while working and blinks now and then', () => {
    expect(expressionFor('type', null, 1, 0)).toBe('focused');
    expect(expressionFor('idle', null, 0.05, 0)).toBe('blink');
    expect(expressionFor('idle', null, 2, 0)).toBe('neutral');
  });
});
