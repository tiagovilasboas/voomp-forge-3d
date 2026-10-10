import { describe, expect, it } from 'vitest';
import { buildWorld } from '../world/buildWorld';
import { automationStand, planNpcPatrol } from './npc';
import { compile, sample } from './script';

const hub = buildWorld([], [], []).aiHub;

describe('planNpcPatrol', () => {
  const script = planNpcPatrol(hub);

  it('keeps every waypoint inside the hub', () => {
    const [cx, cz] = hub.center;
    const points = [script.start, ...script.steps.flatMap((s) => ('to' in s ? [s.to] : []))];
    expect(points.length).toBeGreaterThanOrEqual(4);
    for (const [x, z] of points) {
      expect(Math.abs(x - cx)).toBeLessThan(hub.size[0] / 2);
      expect(Math.abs(z - cz)).toBeLessThan(hub.size[1] / 2);
    }
  });

  it('inspects and reads the tablet facing the automation desk', () => {
    for (const action of ['inspect', 'tablet'] as const) {
      const step = script.steps.find((s) => s.action === action);
      expect(step && 'face' in step ? step.face : null).toEqual(hub.automation);
    }
    const inspect = script.steps.find((s) => s.action === 'inspect');
    expect(inspect && 'duration' in inspect ? inspect.duration : 0).toBeGreaterThanOrEqual(3);
  });

  it('starts and ends in front of the desk, and is deterministic', () => {
    expect(script.start).toEqual(automationStand(hub));
    expect(planNpcPatrol(hub)).toEqual(script);
    const c = { ...compile(script), offset: script.offset };
    expect(sample(c, 1).action).toBe('inspect');
    expect(sample(c, c.length).position[0]).toBeCloseTo(script.start[0], 5);
  });
});
