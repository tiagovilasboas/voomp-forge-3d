import { describe, expect, it } from 'vitest';
import { planBehaviour, type ActivityFacts } from './behaviour';
import { compile, sample } from './script';
import { rigPose } from './rig';
import type { FigureLayout, SectorLayout, WorldModel } from '../world/worldModel';

const sector = { squadId: 'sq-a', center: [0, 0], size: [17, 15], boards: { deliveries: [0, 0], changes: [0, 0] } } as unknown as SectorLayout;
const world = { sectors: [sector], racks: [], figures: [], corridorZ: 10.5, gate: [3.5, 15] } as unknown as WorldModel;
const figure: FigureLayout = { personId: 'ct-a', squadId: 'sq-a', role: 'developer', desk: [-2, 3.4], home: [-2, 4.4] };
const facts = (ride: ActivityFacts['ride']): ActivityFacts => ({ authoringRepoIds: [], reviewingRepoIds: [], celebrates: false, ride });

describe('production ride', () => {
  it('plans no ride without facts', () => {
    expect(planBehaviour(figure, facts(null), world).steps.some((s) => s.action === 'ride')).toBe(false);
  });

  it('deploying: rides to the gate, inspects 2s, rides back and returns home', () => {
    const { steps } = planBehaviour(figure, facts('deploying'), world);
    const rides = steps.filter((s) => s.action === 'ride');
    expect(rides.length).toBe(4);
    const at = steps.findIndex((s) => s.action === 'inspect');
    expect(steps[at]).toMatchObject({ duration: 2 });
    expect(steps[at - 1].action).toBe('ride');
    expect(steps[at + 1].action).toBe('ride');
    expect(steps.some((s) => s.action === 'celebrate')).toBe(false);
    expect(steps[steps.length - 1].action).toBe('idle');
  });

  it('celebrating: cheers 2.4s at the gate', () => {
    const { steps } = planBehaviour(figure, facts('celebrating'), world);
    expect(steps.find((s) => s.action === 'celebrate')).toMatchObject({ duration: 2.4 });
  });

  it('rides faster than walking, along the corridor, and reaches the gate', () => {
    const script = planBehaviour(figure, facts('deploying'), world);
    const c = compile(script);
    const ride = c.segments.find((s) => s.action === 'ride')!;
    const walk = c.segments.find((s) => s.action === 'walk')!;
    const speed = (s: typeof ride) => Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]) / s.duration;
    expect(speed(ride)).toBeGreaterThan(speed(walk) * 2);
    expect(ride.from[1]).toBe(world.corridorZ);
    const inspect = c.segments.find((s) => s.action === 'inspect')!;
    expect(Math.hypot(inspect.from[0] - world.gate[0], inspect.from[1] - world.gate[1])).toBeLessThan(2);
    const pose = sample({ ...c, offset: 0 }, ride.start + ride.duration / 2);
    expect(pose.action).toBe('ride');
  });

  it('ride pose leans forward with arms on the handlebar', () => {
    const r = rigPose('ride', 1, 1);
    expect(r.lean).toBeGreaterThan(0);
    expect(r.armL).toBeLessThan(-0.8);
    expect(r.legL).toBe(0);
  });
});
