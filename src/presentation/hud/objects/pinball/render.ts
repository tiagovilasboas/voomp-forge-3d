import {
  BALL_R, FIELD_H, FIELD_W, LANE_COUNT, LANE_H, LANE_STEP, LANE_W, LANE_X0, LANE_Y0, flipperTipX, flipperTipY, type Sim,
} from './physics';
import { STAGE_NAMES } from './puzzles';

const CYAN = '#38E1FF';
const ORANGE = '#FF8C32';
export const TRAIL_LEN = 16;

export interface RenderOptions {
  trail: Float32Array; // [x0,y0,x1,y1,...] ring, newest at `trailHead`
  trailHead: number;
  showTrail: boolean;
  charge: number;
  shake: number;
  pulse: number;
}

export function draw(ctx: CanvasRenderingContext2D, sim: Sim, o: RenderOptions): void {
  ctx.save();
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);
  if (o.shake > 0) ctx.translate(Math.sin(sim.time * 90) * o.shake * 4, Math.cos(sim.time * 70) * o.shake * 3);

  const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  bg.addColorStop(0, '#04141c');
  bg.addColorStop(1, '#03080b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  // Walls
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = CYAN;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 10;
  const w = sim.table.walls;
  ctx.beginPath();
  for (let i = 0; i < w.length; i += 4) {
    ctx.moveTo(w[i], w[i + 1]);
    ctx.lineTo(w[i + 2], w[i + 3]);
  }
  ctx.stroke();

  // Lanes
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < LANE_COUNT; i++) {
    const x = LANE_X0 + i * LANE_STEP;
    const lit = i < sim.laneProgress;
    const next = i === sim.laneProgress;
    ctx.shadowBlur = lit ? 14 : 4;
    ctx.strokeStyle = next ? ORANGE : CYAN;
    ctx.shadowColor = next ? ORANGE : CYAN;
    ctx.globalAlpha = lit ? 1 : next ? 0.6 + 0.4 * o.pulse : 0.35;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, LANE_Y0, LANE_W, LANE_H);
    if (lit) {
      ctx.fillStyle = CYAN;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x, LANE_Y0, LANE_W, LANE_H);
    }
    ctx.globalAlpha = lit || next ? 1 : 0.6;
    ctx.fillStyle = lit ? '#fff' : next ? ORANGE : CYAN;
    ctx.shadowBlur = 0;
    ctx.fillText(STAGE_NAMES[i], x + LANE_W / 2, LANE_Y0 + LANE_H + 12);
  }
  ctx.globalAlpha = 1;

  // Bumpers
  for (let i = 0; i < sim.table.bumpers.length; i++) {
    const b = sim.table.bumpers[i];
    const flash = sim.bumperFlash[i] > 0;
    ctx.shadowColor = ORANGE;
    ctx.shadowBlur = flash ? 28 : 12;
    ctx.strokeStyle = flash ? '#fff' : ORANGE;
    ctx.fillStyle = flash ? 'rgba(255,140,50,0.55)' : 'rgba(255,140,50,0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Puzzle targets
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px ui-monospace, monospace';
  for (let i = 0; i < sim.table.targets.length; i++) {
    const t = sim.table.targets[i];
    const cooling = sim.targetCooldown[i] > 0;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = cooling ? 2 : 14;
    ctx.strokeStyle = CYAN;
    ctx.globalAlpha = cooling ? 0.35 : 1;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = CYAN;
    ctx.shadowBlur = 0;
    ctx.fillText('?', t.x, t.y + 1);
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  // Flippers
  ctx.strokeStyle = ORANGE;
  ctx.shadowColor = ORANGE;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 10;
  for (let i = 0; i < 2; i++) {
    const f = sim.flippers[i];
    ctx.beginPath();
    ctx.moveTo(f.px, f.py);
    ctx.lineTo(flipperTipX(f), flipperTipY(f));
    ctx.stroke();
  }

  // Plunger charge
  if (o.charge > 0) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = ORANGE;
    ctx.fillRect(390, 624 - o.charge * 30, 16, 3);
  }

  // Trail + ball
  if (o.showTrail) {
    ctx.shadowBlur = 0;
    for (let k = 1; k < TRAIL_LEN; k++) {
      const idx = ((o.trailHead - k + TRAIL_LEN) % TRAIL_LEN) * 2;
      ctx.globalAlpha = (1 - k / TRAIL_LEN) * 0.4;
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.arc(o.trail[idx], o.trail[idx + 1], BALL_R * (1 - k / TRAIL_LEN) * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#EFFFFF';
  ctx.beginPath();
  ctx.arc(sim.ball.x, sim.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
