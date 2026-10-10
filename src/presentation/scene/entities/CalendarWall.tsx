import { useMemo } from 'react';
import { deliveryCalendar, type CalendarDay } from '@application/queries/calendar';
import type { Vec2 } from '../../world/worldModel';
import { useInteractive } from '../../interaction/useInteractive';
import { useReadyData } from '../../state/dataStore';
import { useScope } from '../../state/selectors';
import { HOLO, drawTitle, holoFonts } from '../holo/holoDraw';
import { HoloWall } from './holoWallKit';

const CW = 1280;
const CH = 768;
const ORANGE = '#FF8C32';
const WEEKDAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

function drawCalendar(ctx: CanvasRenderingContext2D, w: number, h: number, days: CalendarDay[], today: string) {
  drawTitle(ctx, w, 'CALENDÁRIO DE ENTREGAS', `${days.length} dias`);
  if (!days.length) return;
  const cols = 7;
  const first = new Date(`${days[0].date}T12:00:00`);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const rows = Math.ceil((offset + days.length) / cols);
  const gx = 28;
  const headY = 112;
  const gy = 128;
  const cw = (w - gx * 2) / cols;
  const ch = Math.min(120, (h - gy - 56) / rows);
  ctx.font = holoFonts.mono(18, 700);
  ctx.fillStyle = HOLO.dim;
  ctx.textAlign = 'center';
  WEEKDAYS.forEach((d, i) => ctx.fillText(d, gx + i * cw + cw / 2, headY));
  days.forEach((day, i) => {
    const n = i + offset;
    const x = gx + (n % cols) * cw;
    const y = gy + Math.floor(n / cols) * ch;
    const isToday = day.date === today;
    ctx.fillStyle = 'rgba(56,225,255,0.07)';
    ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6);
    if (isToday) {
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 4, y + 4, cw - 8, ch - 8);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = isToday ? ORANGE : HOLO.ink;
    ctx.font = holoFonts.display(24, 700);
    ctx.fillText(String(Number(day.date.slice(8))), x + 12, y + 30);
    const glyphs: [number, string][] = [
      [day.counts.deployed_production, HOLO.ok],
      [day.counts.deployed_staging, HOLO.warn],
      [day.counts.merged, ORANGE],
      [day.counts.pipeline_failed, HOLO.fail],
    ];
    let gxx = x + 14;
    const gyy = y + ch - 24;
    ctx.font = holoFonts.mono(17, 700);
    for (const [count, color] of glyphs) {
      if (!count) continue;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(gxx, gyy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(String(count), gxx + 11, gyy + 6);
      gxx += 18 + ctx.measureText(String(count)).width + 8;
    }
  });
  // legend
  const ly = h - 22;
  let lx = gx;
  ctx.font = holoFonts.mono(16, 600);
  for (const [label, color] of [['produção', HOLO.ok], ['staging', HOLO.warn], ['merge', ORANGE], ['falha', HOLO.fail]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lx + 7, ly - 5, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = HOLO.dim;
    ctx.fillText(label, lx + 20, ly);
    lx += 40 + ctx.measureText(label).width;
  }
  ctx.textAlign = 'left';
}

/** "Calendário de Entregas": the scope period as a holographic month grid of evidence counts. */
export function CalendarWall({ position, reducedMotion }: { position: Vec2; reducedMotion: boolean }) {
  const { index } = useReadyData();
  const scope = useScope();
  const { hovered, selected, handlers } = useInteractive({ kind: 'calendar' });
  const days = useMemo(() => deliveryCalendar(index, scope), [index, scope]);
  const today = days[days.length - 1]?.date ?? '';
  const key = days.map((d) => `${d.date}:${Object.values(d.counts).join(',')}`).join('|');
  return (
    <HoloWall
      position={position}
      size={[4, 2.4]}
      canvas={[CW, CH]}
      draw={(ctx, w, h) => drawCalendar(ctx, w, h, days, today)}
      drawKey={key}
      hovered={hovered}
      selected={selected}
      reducedMotion={reducedMotion}
      handlers={handlers}
    />
  );
}
