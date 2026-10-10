import { useMemo } from 'react';
import type { ChangeRequest } from '@domain/entities';
import { toDelivery } from '@application/queries/deliveries';
import { inPeriod } from '@application/queries/period';
import { useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { useScope } from '../../state/selectors';
import type { Draw } from '../kit/canvasTexture';
import { HoloPanel } from './HoloPanel';
import {
  HOLO, drawBar, drawEmpty, drawRow, drawSparkline, drawStat, drawStepper, drawTitle, relativeTime, truncate, type StepState,
} from './holoDraw';

const DAY = 86_400_000;
const YAW = 0.62;
const RIGHT = [Math.cos(YAW), -Math.sin(YAW)] as const;
const TOWARD = [Math.sin(YAW), Math.cos(YAW)] as const;

/** Panel slots in the camera-facing frame: sideways, height, towards-camera. */
const SLOTS: [number, number, number][] = [
  [-3.5, 4.4, 0],
  [-4.1, 2.3, 0.4],
  [3.5, 4.4, 0],
  [4.1, 2.3, 0.4],
  [0, 6.1, -0.6],
];

interface PanelSpec {
  title: string;
  key: string;
  draw: Draw;
}

function stepperState(...states: string[]): StepState {
  if (states.includes('blocked')) return 'blocked';
  if (states.every((s) => s === 'done')) return 'done';
  if (states.includes('unknown')) return 'unknown';
  return 'pending';
}

function useRepoPanels(repoId: string, selectedCrId: string | null): PanelSpec[] {
  const { index, snapshot } = useReadyData();
  const scope = useScope();
  return useMemo(() => {
    const now = scope.now;
    const period = `${scope.periodDays} dias`;
    const commits = index.commitsByRepo.get(repoId) ?? [];
    const crs = index.crsByRepo.get(repoId) ?? [];
    const vocab = snapshot.source.provider.vocabulary;
    const short = vocab.changeRequestShort;
    const inP = commits.filter((c) => inPeriod(scope, c.committedAt));

    // 1 overview
    const contributors = new Set(inP.map((c) => c.authorId)).size;
    const open = crs.filter((c) => c.state === 'open').length;
    const days = Array.from({ length: 30 }, () => 0);
    for (const c of commits) {
      const d = Math.floor((now.getTime() - Date.parse(c.committedAt)) / DAY);
      if (d >= 0 && d < 30) days[29 - d]++;
    }
    const overview: PanelSpec = {
      title: 'Visão do repositório',
      key: `ov|${repoId}|${inP.length}|${open}|${contributors}|${days.join(',')}`,
      draw: (ctx, w, h) => {
        drawTitle(ctx, w, 'Visão do repositório', period);
        if (!commits.length && !crs.length) return drawEmpty(ctx, w, h);
        drawStat(ctx, 28, 160, String(inP.length), 'commits no período');
        drawStat(ctx, 250, 160, String(open), 'mudanças abertas');
        drawStat(ctx, 450, 160, String(contributors), 'pessoas');
        ctx.fillStyle = HOLO.dim;
        ctx.font = holoSmall;
        ctx.fillText('commits por dia · 30 dias', 28, 255);
        drawSparkline(ctx, 28, 270, w - 56, 90, days);
      },
    };

    // 2 history
    const last = commits.slice(0, 5);
    const history: PanelSpec = {
      title: 'Histórico de commits',
      key: `hi|${last.map((c) => c.sha).join(',')}`,
      draw: (ctx, w, h) => {
        drawTitle(ctx, w, 'Histórico de commits');
        if (!last.length) return drawEmpty(ctx, w, h);
        ctx.strokeStyle = 'rgba(56,225,255,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(38, 112);
        ctx.lineTo(38, 112 + (last.length - 1) * 56);
        ctx.stroke();
        last.forEach((c, i) => {
          const cr = c.changeRequestId ? index.cr.get(c.changeRequestId) : null;
          const color = cr?.state === 'merged' ? HOLO.ok : cr ? HOLO.warn : HOLO.border;
          drawRow(ctx, 28, 118 + i * 56, truncate(c.message.split('\n')[0], 34), c.sha.slice(0, 7), relativeTime(now, c.committedAt), color);
        });
      },
    };

    // 3 changes
    const open1 = crs.filter((c) => c.state === 'open' && inPeriod(scope, c.createdAt));
    const inReview = open1.filter((c) => !c.draft && (index.reviewsByCr.get(c.id)?.length ?? 0) > 0).length;
    const openOnly = open1.length - inReview;
    const merged = crs.filter((c) => c.state === 'merged' && inPeriod(scope, c.mergedAt)).length;
    const total = openOnly + inReview + merged;
    const changes: PanelSpec = {
      title: `${vocab.changeRequest}s`,
      key: `ch|${openOnly}|${inReview}|${merged}`,
      draw: (ctx, w, h) => {
        drawTitle(ctx, w, `${vocab.changeRequest}s`, period);
        if (!total) return drawEmpty(ctx, w, h);
        [
          ['abertas', openOnly, HOLO.border],
          ['em revisão', inReview, HOLO.warn],
          ['integradas', merged, HOLO.ok],
        ].forEach(([label, n, color], i) => {
          const y = 140 + i * 90;
          ctx.fillStyle = HOLO.ink;
          ctx.font = holoBig;
          ctx.fillText(String(n), 28, y + 10);
          ctx.fillStyle = HOLO.dim;
          ctx.font = holoSmall;
          ctx.fillText(String(label), 120, y - 8);
          drawBar(ctx, 120, y + 6, w - 160, (n as number) / total, color as string);
        });
      },
    };

    // 4 pipeline
    const cr: ChangeRequest | undefined = (selectedCrId ? index.cr.get(selectedCrId) : undefined) ?? crs[0];
    const delivery = cr ? toDelivery(index, cr) : null;
    const st = (id: string) => delivery?.stages.find((s) => s.id === id)?.state ?? 'unknown';
    const norm = (s: string): StepState => (s === 'done' || s === 'blocked' || s === 'unknown' ? s : 'pending');
    const steps = delivery
      ? [
          { label: 'Código', state: norm(st('opened')) },
          { label: 'Revisão', state: stepperState(st('in_review'), st('approved')) },
          { label: 'Integração', state: norm(st('merged')) },
          { label: 'Staging', state: norm(st('deployed')) },
          { label: 'Produção', state: norm(st('production')) },
        ]
      : [];
    const pipeline: PanelSpec = {
      title: 'Pipeline de entrega',
      key: `pi|${cr?.id}|${steps.map((s) => s.state).join(',')}`,
      draw: (ctx, w, h) => {
        drawTitle(ctx, w, 'Pipeline de entrega');
        if (!cr) return drawEmpty(ctx, w, h);
        ctx.fillStyle = HOLO.ink;
        ctx.font = holoMid;
        ctx.fillText(truncate(`${short} #${cr.number} · ${cr.title}`, 40), 28, 126);
        drawStepper(ctx, w, 230, steps);
        ctx.fillStyle = HOLO.dim;
        ctx.font = holoSmall;
        ctx.fillText('? = a fonte não informa · tracejado = sem evidência ainda', 28, h - 40);
      },
    };

    // 5 recent integrations
    const recent = crs
      .filter((c) => c.state === 'merged' && c.mergedAt)
      .sort((a, b) => b.mergedAt!.localeCompare(a.mergedAt!))
      .slice(0, 3);
    const integ: PanelSpec = {
      title: 'Integrações recentes',
      key: `in|${recent.map((c) => c.id).join(',')}`,
      draw: (ctx, w, h) => {
        drawTitle(ctx, w, 'Integrações recentes');
        if (!recent.length) return drawEmpty(ctx, w, h);
        recent.forEach((c, i) =>
          drawRow(ctx, 28, 130 + i * 84, truncate(`#${c.number} ${c.title}`, 34), c.workItems[0]?.key ?? 'sem tarefa', relativeTime(now, c.mergedAt), HOLO.ok),
        );
      },
    };

    return [overview, history, changes, pipeline, integ];
  }, [index, snapshot, scope, repoId, selectedCrId]);
}

const holoSmall = '500 20px "JetBrains Mono", ui-monospace, monospace';
const holoMid = '600 24px "Space Grotesk", "Inter", sans-serif';
const holoBig = '700 44px "Space Grotesk", "Inter", sans-serif';

function Panels({ repoId, crId, at }: { repoId: string; crId: string | null; at: readonly [number, number] }) {
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const panels = useRepoPanels(repoId, crId);
  return (
    <>
      {panels.map((p, i) => {
        const [side, up, toward] = SLOTS[i];
        const pos: [number, number, number] = [
          at[0] + RIGHT[0] * side + TOWARD[0] * toward,
          up,
          at[1] + RIGHT[1] * side + TOWARD[1] * toward,
        ];
        return <HoloPanel key={`${repoId}-${i}`} position={pos} draw={p.draw} drawKey={p.key} reducedMotion={reducedMotion} phase={i * 1.3} />;
      })}
    </>
  );
}

/** Five holographic panels around the selected repository's rack (tablet/desktop only). */
export function RepoHologram() {
  const { world, index } = useReadyData();
  const selection = useUiStore((s) => s.selection);
  if (typeof window === 'undefined' || window.innerWidth < 768 || !selection) return null;
  const cr = selection.kind === 'cr' ? index.cr.get(selection.id) : null;
  const repoId = selection.kind === 'repo' ? selection.id : (cr?.repositoryId ?? null);
  const rack = repoId ? world.racks.find((r) => r.repoId === repoId) : null;
  if (!repoId || !rack) return null;
  return <Panels repoId={repoId} crId={cr?.id ?? null} at={rack.position} />;
}
