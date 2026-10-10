import { describe, expect, it } from 'vitest';
import {
  advance, clearEvents, createSim, DT, EV_DRAIN, EV_FLIPPER, EV_LANE, evKind, flipperTipX, flipperTipY, launch, setFlippers, step,
  type Sim,
} from './physics';

const has = (sim: Sim, kind: number) => Array.from(sim.events.subarray(0, sim.eventCount)).some((c) => evKind(c) === kind);
const place = (sim: Sim, x: number, y: number, vx = 0, vy = 0) => Object.assign(sim.ball, { x, y, vx, vy });

describe('pinball physics', () => {
  it('ball falls under gravity', () => {
    const sim = createSim();
    place(sim, 200, 300);
    // Keep clear of the bumpers: x=60 is free of obstacles between y=300 and 330.
    place(sim, 60, 300);
    for (let i = 0; i < 12; i++) step(sim);
    expect(sim.ball.vy).toBeGreaterThan(0);
    expect(sim.ball.y).toBeGreaterThan(300);
  });

  it('bounces off a wall', () => {
    const sim = createSim();
    place(sim, 60, 300, -300, 0);
    let bounced = false;
    for (let i = 0; i < 120 && !bounced; i++) {
      step(sim);
      bounced = sim.ball.vx > 0;
    }
    expect(bounced).toBe(true);
    expect(sim.ball.x).toBeGreaterThanOrEqual(10 + 8 - 1e-6);
  });

  it('is deterministic', () => {
    const run = () => {
      const sim = createSim();
      place(sim, 80, 100, 200, 50);
      for (let i = 0; i < 600; i++) step(sim);
      return [sim.ball.x, sim.ball.y, sim.ball.vx, sim.ball.vy];
    };
    expect(run()).toEqual(run());
  });

  it('flipper hit adds upward velocity', () => {
    const sim = createSim();
    const f = sim.flippers[0];
    const x = f.px + 44;
    const y = f.py + 44 * Math.tan(f.angle) - 16;
    place(sim, x, y);
    for (let i = 0; i < 40; i++) step(sim); // settles on the resting flipper
    setFlippers(sim, true, false);
    let minVy = 0;
    for (let i = 0; i < 40; i++) {
      step(sim);
      minVy = Math.min(minVy, sim.ball.vy);
    }
    expect(minVy).toBeLessThan(-250);
  });

  it('flipper tip rises when active', () => {
    const sim = createSim();
    const rest = flipperTipY(sim.flippers[1]);
    setFlippers(sim, false, true);
    for (let i = 0; i < 60; i++) step(sim);
    expect(flipperTipY(sim.flippers[1])).toBeLessThan(rest);
    expect(flipperTipX(sim.flippers[1])).toBeLessThan(sim.flippers[1].px);
  });

  it('detects the drain', () => {
    const sim = createSim();
    place(sim, 198, 560, 0, 200);
    let drained = false;
    for (let i = 0; i < 400 && !drained; i++) {
      clearEvents(sim);
      step(sim);
      drained = has(sim, EV_DRAIN);
    }
    expect(drained).toBe(true);
    expect(sim.ball.x).toBeGreaterThan(386); // back in the plunger lane
  });

  it('a full plunger launch leaves the shooter lane and enters the field', () => {
    const sim = createSim();
    for (let i = 0; i < 60; i++) step(sim); // settle in the lane
    expect(launch(sim, 1)).toBe(true);
    let entered = false;
    for (let i = 0; i < 120 * 6 && !entered; i++) {
      step(sim);
      entered = sim.ball.x < 370 && sim.ball.y < 400;
    }
    expect(entered).toBe(true);
  });

  it('lights lanes in order and awards on completion', () => {
    const sim = createSim();
    for (let i = 0; i < 5; i++) {
      clearEvents(sim);
      place(sim, 98 + i * 50, 100 + 4);
      sim.ball.vy = 0;
      step(sim);
      expect(has(sim, EV_LANE)).toBe(true);
    }
    expect(sim.laneProgress).toBe(0);
  });

  it('advance consumes whole fixed steps only', () => {
    const sim = createSim();
    const left = advance(sim, DT * 2.5);
    expect(sim.time).toBeCloseTo(DT * 2, 9);
    expect(left).toBeCloseTo(DT * 0.5, 9);
  });

  it('emits flipper events when a moving flipper hits the ball', () => {
    const sim = createSim();
    const f = sim.flippers[0];
    place(sim, f.px + 44, f.py + 44 * Math.tan(f.angle) - 16);
    for (let i = 0; i < 40; i++) step(sim);
    setFlippers(sim, true, false);
    let hit = false;
    for (let i = 0; i < 40; i++) {
      step(sim);
      hit ||= has(sim, EV_FLIPPER);
    }
    expect(hit).toBe(true);
  });
});
