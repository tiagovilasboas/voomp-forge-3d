import { describe, expect, it } from 'vitest';
import type { Contributor, Repository, Squad } from '@domain/entities';
import { LAYOUT } from '@config/world';
import { planBehaviour } from '../animation/behaviour';
import { compile } from '../animation/script';
import { buildWorld } from './buildWorld';
import { flowPath } from './flowPaths';
import { toWorld } from './frame';
import type { Vec2, WorldModel } from './worldModel';

function data(squadCount: number, reposPer = 3, peoplePer = 4) {
  const squads = Array.from({ length: squadCount }, (_, i) => ({ id: `sq-${i}`, code: `S${i}`, name: `Squad ${i}` })) as unknown as Squad[];
  const repos = squads.flatMap((s, i) => Array.from({ length: reposPer + (i % 2) }, (_, j) => ({ id: `${s.id}-r${j}`, squadId: s.id }))) as unknown as Repository[];
  const people = squads.flatMap((s) => Array.from({ length: peoplePer }, (_, j) => ({ id: `${s.id}-p${j}`, squadId: s.id, role: 'developer' }))) as unknown as Contributor[];
  return { squads, repos, people };
}
const worldOf = (n: number) => {
  const d = data(n);
  return buildWorld(d.squads, d.repos, d.people);
};

interface Rect {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
const rooms = (w: WorldModel): Rect[] =>
  [...w.sectors.map((s) => ({ id: s.squadId, center: s.center, size: s.size })), { id: 'hub', center: w.aiHub.center, size: w.aiHub.size }].map((r) => ({
    id: r.id,
    x0: r.center[0] - r.size[0] / 2,
    x1: r.center[0] + r.size[0] / 2,
    z0: r.center[1] - r.size[1] / 2,
    z1: r.center[1] + r.size[1] / 2,
  }));
const inside = (r: Rect, [x, z]: Vec2) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe.each([1, 2, 3, 5, 8])('buildWorld with %i squads', (n) => {
  const w = worldOf(n);
  const all = rooms(w);
  const half = LAYOUT.corridorWidth / 2;

  it('puts the hub in the north row and every room on one of two rows facing the corridor', () => {
    expect(w.aiHub.facing).toBe(1);
    for (const r of all) {
      const north = r.z1 <= w.corridorZ - half + 1e-9;
      const south = r.z0 >= w.corridorZ + half - 1e-9;
      expect(north || south, `${r.id} must clear the corridor`).toBe(true);
    }
    for (const s of w.sectors) expect(s.facing).toBe(s.center[1] < w.corridorZ ? 1 : -1);
    expect(w.sectors.some((s) => s.facing === -1) || n === 1).toBe(true);
  });

  it('rooms do not overlap each other', () => {
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlap(all[i], all[j]), `${all[i].id} vs ${all[j].id}`).toBe(false);
  });

  it('keeps the production plaza inside the corridor band and clear of rooms', () => {
    const plaza = [w.gate, w.stagingDock, w.weekBoard, w.creditPlaque, w.frontsWall, w.calendarWall];
    for (const [x, z] of plaza) {
      expect(Math.abs(z - w.corridorZ)).toBeLessThan(half - 1);
      for (const r of all) expect(inside(r, [x, z])).toBe(false);
      expect(x).toBeGreaterThan(w.bounds.min[0]);
      expect(x).toBeLessThan(w.bounds.max[0]);
    }
  });

  it('keeps racks, desks, homes and boards inside their own room', () => {
    for (const rack of w.racks) {
      const s = w.sectors.find((x) => x.squadId === rack.squadId)!;
      const room = all.find((r) => r.id === s.squadId)!;
      expect(inside(room, rack.position)).toBe(true);
      expect(inside(room, rack.servicePoint)).toBe(true);
      expect(rack.facing).toBe(s.facing);
    }
    for (const f of w.figures) {
      const room = all.find((r) => r.id === f.squadId)!;
      expect(inside(room, f.desk)).toBe(true);
      expect(inside(room, f.home)).toBe(true);
    }
    for (const s of w.sectors) {
      const room = all.find((r) => r.id === s.squadId)!;
      for (const p of [s.boards.changes, s.boards.deliveries, s.feature]) expect(inside(room, p)).toBe(true);
    }
    const hub = all.find((r) => r.id === 'hub')!;
    for (const p of [w.aiHub.terminal, w.aiHub.pinball, w.aiHub.automation, w.knowledgeVault]) expect(inside(hub, p)).toBe(true);
  });

  it('keeps every room inside the bounds', () => {
    for (const r of all) {
      expect(r.x0).toBeGreaterThan(w.bounds.min[0]);
      expect(r.x1).toBeLessThan(w.bounds.max[0]);
      expect(r.z0).toBeGreaterThan(w.bounds.min[1]);
      expect(r.z1).toBeLessThan(w.bounds.max[1]);
    }
  });

  it('is deterministic', () => {
    expect(worldOf(n)).toEqual(w);
  });
});

describe('square footprint', () => {
  it('stays within 1:1.4 for the demo shape (3 squads + hub)', () => {
    const w = worldOf(3);
    const width = w.bounds.max[0] - w.bounds.min[0];
    const depth = w.bounds.max[1] - w.bounds.min[1];
    expect(Math.max(width / depth, depth / width)).toBeLessThanOrEqual(1.4);
  });

  it('balances both rows by width', () => {
    const w = worldOf(3);
    const span = (facing: 1 | -1) => {
      const rs = rooms(w).filter((r) => (facing === 1 ? r.z1 < w.corridorZ : r.z0 > w.corridorZ));
      return Math.max(...rs.map((r) => r.x1)) - Math.min(...rs.map((r) => r.x0));
    };
    expect(Math.abs(span(1) - span(-1))).toBeLessThan(8);
  });

  it('adds columns, not rows, as squads grow', () => {
    const w = worldOf(8);
    expect(new Set(rooms(w).map((r) => (r.z0 + r.z1) / 2)).size).toBe(2);
  });
});

describe('room frame', () => {
  it('maps room-local offsets with a 180° turn for facing -1', () => {
    expect(toWorld([10, -5], 1, [2, 3])).toEqual([12, -2]);
    expect(toWorld([10, 5], -1, [2, 3])).toEqual([8, 2]);
  });
});

describe('south-row behaviour', () => {
  const w = worldOf(3);
  const south = w.sectors.find((s) => s.facing === -1)!;
  const north = w.sectors.find((s) => s.facing === 1)!;
  const figure = (s: typeof south) => w.figures.find((f) => f.squadId === s.squadId)!;

  it('rides from the south room through the corridor to the south side of the gate and back', () => {
    const f = figure(south);
    const script = planBehaviour(f, { authoringRepoIds: [], reviewingRepoIds: [], celebrates: false, ride: 'deploying' }, w);
    const c = compile(script);
    const ride = c.segments.find((s) => s.action === 'ride')!;
    expect(ride.from[1]).toBe(south.laneZ);
    expect(Math.abs(south.laneZ - w.corridorZ)).toBeLessThan(LAYOUT.corridorWidth / 2);
    const inspect = c.segments.find((s) => s.action === 'inspect')!;
    expect(Math.hypot(inspect.from[0] - w.gate[0], inspect.from[1] - w.gate[1])).toBeLessThan(2);
    expect(inspect.from[1]).toBeGreaterThan(w.gate[1]); // south row stops on the south side
    const first = c.segments[0];
    expect(first.from).toEqual(f.home);
    // the figure reaches the corridor band while leaving the room
    const reachesCorridor = c.segments.some((s) => Math.abs(s.to[1] - w.corridorZ) < LAYOUT.corridorWidth / 2);
    expect(reachesCorridor).toBe(true);
    // and the last pose is back home
    const last = c.segments[c.segments.length - 1];
    expect(last.to[0]).toBeCloseTo(f.home[0], 5);
    expect(last.to[1]).toBeCloseTo(f.home[1], 5);
  });

  it('north row stops on the north side of the gate', () => {
    const f = figure(north);
    const script = planBehaviour(f, { authoringRepoIds: [], reviewingRepoIds: [], celebrates: false, ride: 'celebrating' }, w);
    const celebrate = compile(script).segments.find((s) => s.action === 'celebrate')!;
    expect(celebrate.from[1]).toBeLessThan(w.gate[1]);
  });

  it('walks to a rack inside its own room using the aisle of that room', () => {
    const f = figure(south);
    const rack = w.racks.find((r) => r.squadId === south.squadId)!;
    const script = planBehaviour(f, { authoringRepoIds: [rack.repoId], reviewingRepoIds: [], celebrates: false, ride: null }, w);
    const visit = script.steps.find((s) => s.action === 'inspect')!;
    expect('face' in visit && visit.face).toEqual(rack.position);
    const walks = script.steps.flatMap((s) => (s.action === 'walk' ? [s.to] : []));
    expect(walks.some(([, z]) => z === south.aisleZ)).toBe(true);
  });

  it('flows from a south rack leave through the room exit into the corridor and end at the gate', () => {
    const rack = w.racks.find((r) => r.squadId === south.squadId)!;
    const path = flowPath(w, rack.repoId, 'deployed_production')!;
    expect(path[0][1]).toBeGreaterThan(rack.position[1] - 1.5);
    expect(path.some(([x, z]) => x === south.exitX && z === south.laneZ)).toBe(true);
    expect(path[path.length - 1]).toEqual(w.gate);
  });
});
