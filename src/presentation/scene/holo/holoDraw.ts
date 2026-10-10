/** Pure canvas helpers for holographic panels. No Three.js. */
export const HOLO = {
  bg: 'rgba(8,24,40,0.6)',
  border: '#38E1FF',
  ink: '#E6F7FF',
  dim: '#7FA7BA',
  ok: '#34C88A',
  fail: '#EF5350',
  warn: '#F6B94D',
  unknown: '#8B8FB8',
};

const display = (px: number, w = 700) => `${w} ${px}px "Space Grotesk", "Inter", sans-serif`;
const mono = (px: number, w = 600) => `${w} ${px}px "JetBrains Mono", ui-monospace, monospace`;
export const holoFonts = { display, mono };

export const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** "há 3 h", "há 2 d"… relative to `now`. */
export function relativeTime(now: Date, at: string | null | undefined): string {
  if (!at) return '—';
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(at)) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} d`;
}

/** Background, border glow and scanlines. */
export function drawPanelBase(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = HOLO.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(56,225,255,0.05)';
  for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2);
  ctx.save();
  ctx.shadowColor = HOLO.border;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = HOLO.border;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.restore();
}

export function drawTitle(ctx: CanvasRenderingContext2D, w: number, title: string, subtitle?: string) {
  ctx.fillStyle = HOLO.border;
  ctx.font = display(34, 700);
  ctx.textAlign = 'left';
  ctx.fillText(truncate(title, 28), 28, 58);
  if (subtitle) {
    ctx.fillStyle = HOLO.dim;
    ctx.font = mono(20, 500);
    ctx.textAlign = 'right';
    ctx.fillText(subtitle, w - 28, 56);
    ctx.textAlign = 'left';
  }
  ctx.strokeStyle = 'rgba(56,225,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(28, 74);
  ctx.lineTo(w - 28, 74);
  ctx.stroke();
}

export function drawEmpty(ctx: CanvasRenderingContext2D, w: number, h: number, text = 'Sem dados no período') {
  ctx.fillStyle = HOLO.dim;
  ctx.font = display(30, 500);
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + 30);
  ctx.textAlign = 'left';
}

export function drawStat(ctx: CanvasRenderingContext2D, x: number, y: number, value: string, label: string, color = HOLO.ink) {
  ctx.fillStyle = color;
  ctx.font = display(64, 700);
  ctx.fillText(value, x, y);
  ctx.fillStyle = HOLO.dim;
  ctx.font = display(22, 500);
  ctx.fillText(label, x, y + 30);
}

export function drawRow(ctx: CanvasRenderingContext2D, x: number, y: number, main: string, meta: string, right?: string, dot?: string) {
  if (dot) {
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(x + 10, y - 8, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = HOLO.ink;
  ctx.font = display(26, 600);
  ctx.fillText(main, x + 34, y);
  ctx.fillStyle = HOLO.dim;
  ctx.font = mono(18, 500);
  ctx.fillText(meta, x + 34, y + 24);
  if (right) {
    ctx.textAlign = 'right';
    ctx.fillText(right, 612, y);
    ctx.textAlign = 'left';
  }
}

export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number, color: string) {
  ctx.fillStyle = 'rgba(56,225,255,0.12)';
  ctx.fillRect(x, y, w, 14);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, ratio)) * w, 14);
}

export function drawSparkline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, values: number[], color = HOLO.border) {
  if (!values.length) return;
  const max = Math.max(1, ...values);
  const step = w / Math.max(1, values.length - 1);
  const pt = (v: number, i: number): [number, number] => [x + i * step, y + h - (v / max) * h];
  ctx.beginPath();
  values.forEach((v, i) => ctx[i ? 'lineTo' : 'moveTo'](...pt(v, i)));
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(56,225,255,0.15)';
  ctx.fill();
  ctx.beginPath();
  values.forEach((v, i) => ctx[i ? 'lineTo' : 'moveTo'](...pt(v, i)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

export type StepState = 'done' | 'blocked' | 'pending' | 'unknown';

/** Horizontal stepper: circle + label per step, arrows between. */
export function drawStepper(ctx: CanvasRenderingContext2D, w: number, y: number, steps: { label: string; state: StepState }[]) {
  const pad = 52;
  const gap = (w - pad * 2) / (steps.length - 1);
  steps.forEach((s, i) => {
    const cx = pad + i * gap;
    if (i < steps.length - 1) {
      ctx.strokeStyle = 'rgba(56,225,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + 30, y);
      ctx.lineTo(cx + gap - 34, y);
      ctx.moveTo(cx + gap - 44, y - 7);
      ctx.lineTo(cx + gap - 34, y);
      ctx.lineTo(cx + gap - 44, y + 7);
      ctx.stroke();
    }
    const color = s.state === 'done' ? HOLO.ok : s.state === 'blocked' ? HOLO.fail : s.state === 'unknown' ? HOLO.unknown : HOLO.dim;
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    ctx.setLineDash(s.state === 'pending' ? [6, 5] : []);
    ctx.beginPath();
    ctx.arc(cx, y, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = display(30, 700);
    ctx.textAlign = 'center';
    const glyph = s.state === 'done' ? '✓' : s.state === 'blocked' ? '✕' : s.state === 'unknown' ? '?' : '';
    if (glyph) ctx.fillText(glyph, cx, y + 11);
    ctx.fillStyle = HOLO.ink;
    ctx.font = display(19, 600);
    ctx.fillText(s.label, cx, y + 54);
    ctx.textAlign = 'left';
  });
}
