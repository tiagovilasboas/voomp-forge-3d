import { useMemo } from 'react';
import type { WorkstreamCategory } from '@domain/entities';
import type { WorkstreamStatus } from '@domain/rules/workstreamProgress';
import { listWorkstreams, type WorkstreamView } from '@application/queries/workstreams';
import type { Vec2 } from '../../world/worldModel';
import { useInteractive } from '../../interaction/useInteractive';
import { useReadyData } from '../../state/dataStore';
import { useScope } from '../../state/selectors';
import { HOLO, drawTitle, holoFonts, truncate } from '../holo/holoDraw';
import { HoloWall } from './holoWallKit';

const CW = 1800;
const CH = 850;

const STATUS: Record<WorkstreamStatus, { label: string; color: string }> = {
  delivered: { label: 'Entregue', color: HOLO.ok },
  blocked: { label: 'Bloqueada', color: HOLO.fail },
  at_risk: { label: 'Em risco', color: HOLO.warn },
  in_progress: { label: 'Em andamento', color: HOLO.border },
  planned: { label: 'Planejada', color: HOLO.unknown },
  on_demand: { label: 'Sob demanda', color: HOLO.dim },
};
const CATEGORY: Record<WorkstreamCategory, string> = {
  sprint_priority: 'PRIORIDADE DA SPRINT',
  closing: 'EM FECHAMENTO',
  sustaining: 'SUSTENTAÇÃO',
  open_topic: 'TEMAS EM ABERTO',
};

type Slot = { header: string } | { view: WorkstreamView };

function drawFronts(ctx: CanvasRenderingContext2D, w: number, h: number, views: WorkstreamView[]) {
  drawTitle(ctx, w, 'MURAL DE FRENTES', `${views.length} frentes`);
  if (!views.length) {
    ctx.fillStyle = HOLO.dim;
    ctx.font = holoFonts.display(34, 500);
    ctx.textAlign = 'center';
    ctx.fillText('Nenhuma frente no escopo', w / 2, h / 2 + 20);
    ctx.textAlign = 'left';
    return;
  }
  const slots: Slot[] = [];
  let last: string | null = null;
  for (const v of views) {
    if (v.workstream.category !== last) {
      last = v.workstream.category;
      slots.push({ header: CATEGORY[v.workstream.category] });
    }
    slots.push({ view: v });
  }
  const cols = 3;
  const colW = (w - 56 - (cols - 1) * 24) / cols;
  const top = 96;
  const rowH = 62;
  const perCol = Math.floor((h - top - 20) / rowH);
  const capacity = perCol * cols;
  const shown = slots.slice(0, capacity);
  const hidden = slots.slice(capacity).filter((s) => 'view' in s).length;
  if (hidden) {
    // reserve the last slot for the overflow note
    shown.pop();
  }
  shown.forEach((slot, i) => {
    const x = 28 + Math.floor(i / perCol) * (colW + 24);
    const y = top + (i % perCol) * rowH;
    if ('header' in slot) {
      ctx.fillStyle = 'rgba(56,225,255,0.14)';
      ctx.fillRect(x, y + 6, colW, 34);
      ctx.fillStyle = HOLO.border;
      ctx.font = holoFonts.mono(20, 700);
      ctx.fillText(slot.header, x + 12, y + 30);
      return;
    }
    const { workstream: ws, progress: p } = slot.view;
    const st = STATUS[p.status];
    ctx.fillStyle = st.color;
    ctx.beginPath();
    ctx.arc(x + 14, y + 22, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = HOLO.ink;
    ctx.font = holoFonts.display(25, 600);
    ctx.fillText(truncate(ws.name, 27), x + 36, y + 28);
    ctx.fillStyle = st.color;
    ctx.font = holoFonts.mono(17, 700);
    ctx.fillText(st.label, x + 36, y + 52);
    const plan = ws.plans[ws.plans.length - 1]?.label;
    let cx = x + 36 + ctx.measureText(st.label).width + 14;
    ctx.fillStyle = HOLO.dim;
    ctx.font = holoFonts.mono(16, 500);
    if (plan) {
      const text = truncate(plan, 22);
      ctx.fillText(text, cx, y + 52);
      cx += ctx.measureText(text).width + 12;
    }
    // right-aligned marks: evidence (J/G), warnings, replans
    let rx = x + colW - 8;
    ctx.textAlign = 'right';
    if (p.replans > 0) {
      ctx.fillStyle = HOLO.warn;
      ctx.font = holoFonts.mono(17, 700);
      ctx.fillText(`replan ${p.replans}x`, rx, y + 52);
    }
    if (p.divergence || p.declaredWithoutEvidence) {
      ctx.fillStyle = HOLO.warn;
      ctx.font = holoFonts.display(26, 700);
      ctx.fillText('⚠', rx, y + 28);
      rx -= 30;
    }
    for (const src of [...p.evidence].reverse()) {
      ctx.fillStyle = 'rgba(52,200,138,0.25)';
      ctx.fillRect(rx - 22, y + 10, 22, 22);
      ctx.fillStyle = HOLO.ok;
      ctx.font = holoFonts.mono(16, 700);
      ctx.textAlign = 'center';
      ctx.fillText(src === 'tracker' ? 'J' : 'G', rx - 11, y + 27);
      ctx.textAlign = 'right';
      rx -= 28;
    }
    ctx.textAlign = 'left';
  });
  if (hidden) {
    const i = shown.length;
    ctx.fillStyle = HOLO.dim;
    ctx.font = holoFonts.mono(20, 600);
    ctx.fillText(`+ ${hidden} frentes no painel`, 28 + Math.floor(i / perCol) * (colW + 24) + 12, top + (i % perCol) * rowH + 30);
  }
}

/** "Mural de Frentes": holographic wall listing every front with its evidence-based status. */
export function FrontsWall({ position, reducedMotion }: { position: Vec2; reducedMotion: boolean }) {
  const { index } = useReadyData();
  const scope = useScope();
  const { hovered, selected, handlers } = useInteractive({ kind: 'fronts' });
  const views = useMemo(() => listWorkstreams(index, scope), [index, scope]);
  const key = views
    .map((v) => `${v.workstream.id}:${v.progress.status}:${v.progress.evidence.join('')}${v.progress.divergence ? 'd' : ''}${v.progress.declaredWithoutEvidence ? 'x' : ''}${v.progress.replans}:${v.workstream.plans.length}`)
    .join('|');
  return (
    <HoloWall
      position={position}
      size={[5.5, 2.6]}
      canvas={[CW, CH]}
      draw={(ctx, w, h) => drawFronts(ctx, w, h, views)}
      drawKey={key}
      hovered={hovered}
      selected={selected}
      reducedMotion={reducedMotion}
      handlers={handlers}
    />
  );
}
