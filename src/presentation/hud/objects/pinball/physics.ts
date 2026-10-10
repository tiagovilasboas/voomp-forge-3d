/**
 * Holographic pinball physics. Pure and deterministic: a fixed time step (1/120 s), no randomness,
 * no DOM, no allocation inside `step` (everything lives in preallocated typed arrays / objects).
 * Coordinates: x right, y DOWN, playfield 420 x 640.
 */

export const DT = 1 / 120;
export const FIELD_W = 420;
export const FIELD_H = 640;
export const BALL_R = 8;
export const GRAVITY = 750;
const SUBSTEPS = 2;
const MAX_SPEED = 1500;
const WALL_E = 0.5;
const FLIPPER_E = 0.3;
const FLIPPER_R = 5;
const FLIPPER_SPEED = 22; // rad/s
const REST_SPEED = 40;
const TARGET_COOLDOWN = 4;

export const LANE_COUNT = 5;
export const LANE_Y0 = 96;
export const LANE_H = 34;
export const LANE_W = 40;
export const LANE_X0 = 98 - LANE_W / 2;
export const LANE_STEP = 50;

/** Event codes: `kind * 16 + index`. */
export const EV_BUMPER = 1;
export const EV_TARGET = 2;
export const EV_LANE = 3;
export const EV_LANES_DONE = 4;
export const EV_FLIPPER = 5;
export const EV_DRAIN = 6;
export const EV_LAUNCH = 7;
export const evKind = (code: number) => code >> 4;
export const evIndex = (code: number) => code & 15;
const MAX_EVENTS = 32;

export interface Circle {
  x: number;
  y: number;
  r: number;
}
export interface Bumper extends Circle {
  kick: number;
}

export interface Flipper {
  px: number;
  py: number;
  length: number;
  /** +1 left flipper (points right), -1 right flipper (points left). */
  dir: 1 | -1;
  angle: number;
  restAngle: number;
  activeAngle: number;
  /** Angular velocity (rad/s), signed in the `angle` convention. */
  omega: number;
  active: boolean;
}

export interface Table {
  /** Flat [x1, y1, x2, y2, ...] */
  walls: Float64Array;
  bumpers: Bumper[];
  targets: Circle[];
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Sim {
  table: Table;
  ball: Ball;
  flippers: [Flipper, Flipper];
  /** Seconds of remaining highlight per bumper / target. */
  bumperFlash: Float64Array;
  targetFlash: Float64Array;
  targetCooldown: Float64Array;
  /** Number of lanes lit, in order. */
  laneProgress: number;
  events: Int32Array;
  eventCount: number;
  time: number;
}

const deg = (d: number) => (d * Math.PI) / 180;

export function createTable(): Table {
  const pts: Array<[number, number]> = [
    // top arc, right to left
    [410, 170], [402, 110], [378, 62], [330, 28], [270, 14], [210, 10], [150, 14], [90, 28], [42, 62], [18, 110], [10, 170],
  ];
  const w: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) w.push(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  w.push(
    10, 170, 10, 490, // left wall
    10, 490, 130, 570, // left funnel
    386, 490, 266, 570, // right funnel
    386, 160, 386, 622, // shooter lane separator
    410, 170, 410, 622, // outer right wall
    386, 622, 410, 622, // plunger floor
  );
  return {
    walls: Float64Array.from(w),
    bumpers: [
      { x: 140, y: 250, r: 20, kick: 420 },
      { x: 266, y: 250, r: 20, kick: 420 },
      { x: 203, y: 330, r: 20, kick: 420 },
    ],
    targets: [
      { x: 48, y: 380, r: 12 },
      { x: 348, y: 380, r: 12 },
      { x: 203, y: 175, r: 12 },
    ],
  };
}

export function createSim(table: Table = createTable()): Sim {
  const sim: Sim = {
    table,
    ball: { x: 398, y: 612, vx: 0, vy: 0 },
    flippers: [
      { px: 130, py: 570, length: 64, dir: 1, angle: deg(30), restAngle: deg(30), activeAngle: deg(-30), omega: 0, active: false },
      { px: 266, py: 570, length: 64, dir: -1, angle: deg(30), restAngle: deg(30), activeAngle: deg(-30), omega: 0, active: false },
    ],
    bumperFlash: new Float64Array(table.bumpers.length),
    targetFlash: new Float64Array(table.targets.length),
    targetCooldown: new Float64Array(table.targets.length),
    laneProgress: 0,
    events: new Int32Array(MAX_EVENTS),
    eventCount: 0,
    time: 0,
  };
  return sim;
}

/** Puts the ball back in the plunger lane (new ball). Lane progress is kept. */
export function resetBall(sim: Sim): void {
  sim.ball.x = 398;
  sim.ball.y = 612;
  sim.ball.vx = 0;
  sim.ball.vy = 0;
}

export function ballInPlungerLane(sim: Sim): boolean {
  const b = sim.ball;
  return b.x > 386 && b.y > 560 && Math.abs(b.vx) + Math.abs(b.vy) < 40;
}

/** power 0..1. Only works while the ball waits in the plunger lane. */
export function launch(sim: Sim, power: number): boolean {
  if (!ballInPlungerLane(sim)) return false;
  const p = Math.min(1, Math.max(0, power));
  sim.ball.vy = -(780 + 460 * p);
  sim.ball.vx = 0;
  pushEvent(sim, EV_LAUNCH, 0);
  return true;
}

export function setFlippers(sim: Sim, left: boolean, right: boolean): void {
  sim.flippers[0].active = left;
  sim.flippers[1].active = right;
}

export function clearEvents(sim: Sim): void {
  sim.eventCount = 0;
}

function pushEvent(sim: Sim, kind: number, index: number): void {
  if (sim.eventCount < MAX_EVENTS) sim.events[sim.eventCount++] = kind * 16 + index;
}

export function flipperTipX(f: Flipper): number {
  return f.px + f.dir * f.length * Math.cos(f.angle);
}
export function flipperTipY(f: Flipper): number {
  return f.py + f.length * Math.sin(f.angle);
}

function updateFlipper(f: Flipper, dt: number): void {
  const target = f.active ? f.activeAngle : f.restAngle;
  const diff = target - f.angle;
  const stepMax = FLIPPER_SPEED * dt;
  if (Math.abs(diff) <= stepMax) {
    f.omega = diff === 0 ? 0 : diff / dt;
    f.angle = target;
  } else {
    const s = Math.sign(diff);
    f.angle += s * stepMax;
    f.omega = s * FLIPPER_SPEED;
  }
}

/** Resolves ball vs. a moving/static capsule-or-segment. Returns true on contact. */
function collideSegment(
  b: Ball,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  e: number,
  surfVx: number,
  surfVy: number,
  surfScale: number,
): boolean {
  const sx = x2 - x1;
  const sy = y2 - y1;
  const len2 = sx * sx + sy * sy;
  let t = len2 > 0 ? ((b.x - x1) * sx + (b.y - y1) * sy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = x1 + sx * t;
  const cy = y1 + sy * t;
  let dx = b.x - cx;
  let dy = b.y - cy;
  const rr = BALL_R + thickness;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  let d = Math.sqrt(d2);
  if (d < 1e-6) {
    // Centre exactly on the segment: push along the segment normal.
    const l = Math.sqrt(len2) || 1;
    dx = -sy / l;
    dy = sx / l;
    d = 1;
  }
  const nx = dx / d;
  const ny = dy / d;
  b.x = cx + nx * rr;
  b.y = cy + ny * rr;
  // Surface velocity grows with the distance from the pivot (surfScale = t * length).
  const svx = surfVx * surfScale * t;
  const svy = surfVy * surfScale * t;
  const rvx = b.vx - svx;
  const rvy = b.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const k = Math.abs(vn) < REST_SPEED ? 1 : 1 + e;
    b.vx = rvx - k * vn * nx + svx;
    b.vy = rvy - k * vn * ny + svy;
  }
  return true;
}

function collideCircle(b: Ball, c: Circle, e: number, kick: number): boolean {
  const dx = b.x - c.x;
  const dy = b.y - c.y;
  const rr = BALL_R + c.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  const d = Math.sqrt(d2) || 1e-6;
  const nx = dx / d;
  const ny = dy / d;
  b.x = c.x + nx * rr;
  b.y = c.y + ny * rr;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx;
    b.vy -= (1 + e) * vn * ny;
  }
  if (kick > 0) {
    const out = b.vx * nx + b.vy * ny;
    if (out < kick) {
      b.vx += (kick - out) * nx;
      b.vy += (kick - out) * ny;
    }
  }
  return true;
}

/** Advances the simulation by exactly one fixed step (DT). */
export function step(sim: Sim): void {
  const { table, ball: b } = sim;
  const sub = DT / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) {
    for (let i = 0; i < 2; i++) updateFlipper(sim.flippers[i], sub);

    b.vy += GRAVITY * sub;
    const sp2 = b.vx * b.vx + b.vy * b.vy;
    if (sp2 > MAX_SPEED * MAX_SPEED) {
      const k = MAX_SPEED / Math.sqrt(sp2);
      b.vx *= k;
      b.vy *= k;
    }
    b.x += b.vx * sub;
    b.y += b.vy * sub;

    const w = table.walls;
    for (let i = 0; i < w.length; i += 4) collideSegment(b, w[i], w[i + 1], w[i + 2], w[i + 3], 0, WALL_E, 0, 0, 0);

    for (let i = 0; i < 2; i++) {
      const f = sim.flippers[i];
      const tx = flipperTipX(f);
      const ty = flipperTipY(f);
      const sinA = Math.sin(f.angle);
      const cosA = Math.cos(f.angle);
      // d(point)/dt = s * omega * (-dir * sin, cos), s = distance from the pivot.
      if (collideSegment(b, f.px, f.py, tx, ty, FLIPPER_R, FLIPPER_E, -f.dir * sinA * f.omega, cosA * f.omega, f.length)) {
        if (f.omega !== 0) pushEvent(sim, EV_FLIPPER, i);
      }
    }

    for (let i = 0; i < table.bumpers.length; i++) {
      if (collideCircle(b, table.bumpers[i], 0.6, table.bumpers[i].kick)) {
        sim.bumperFlash[i] = 0.15;
        pushEvent(sim, EV_BUMPER, i);
      }
    }
    for (let i = 0; i < table.targets.length; i++) {
      if (collideCircle(b, table.targets[i], 0.6, 0) && sim.targetCooldown[i] <= 0) {
        sim.targetCooldown[i] = TARGET_COOLDOWN;
        sim.targetFlash[i] = 0.3;
        pushEvent(sim, EV_TARGET, i);
      }
    }

    // Rollover lanes: only the next lane in order lights up.
    if (sim.laneProgress < LANE_COUNT && b.y > LANE_Y0 && b.y < LANE_Y0 + LANE_H) {
      const lx = LANE_X0 + sim.laneProgress * LANE_STEP;
      if (b.x > lx && b.x < lx + LANE_W) {
        pushEvent(sim, EV_LANE, sim.laneProgress);
        sim.laneProgress++;
        if (sim.laneProgress === LANE_COUNT) {
          pushEvent(sim, EV_LANES_DONE, 0);
          sim.laneProgress = 0;
        }
      }
    }

    if (b.y > FIELD_H + 30) {
      pushEvent(sim, EV_DRAIN, 0);
      resetBall(sim);
    }
  }

  const dt = DT;
  for (let i = 0; i < sim.bumperFlash.length; i++) if (sim.bumperFlash[i] > 0) sim.bumperFlash[i] -= dt;
  for (let i = 0; i < sim.targetFlash.length; i++) if (sim.targetFlash[i] > 0) sim.targetFlash[i] -= dt;
  for (let i = 0; i < sim.targetCooldown.length; i++) if (sim.targetCooldown[i] > 0) sim.targetCooldown[i] -= dt;
  sim.time += dt;
}

/** Real-time accumulator driver. Returns the leftover accumulator. */
export function advance(sim: Sim, acc: number, maxSteps = 12): number {
  let n = 0;
  while (acc >= DT && n < maxSteps) {
    step(sim);
    acc -= DT;
    n++;
  }
  return n === maxSteps ? 0 : acc;
}
