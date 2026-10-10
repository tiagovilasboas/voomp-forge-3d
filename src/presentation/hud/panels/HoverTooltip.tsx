import { useEffect, useMemo, useState } from 'react';
import { useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { useRepoHealth } from '../../state/selectors';
import { SIGNAL_LOOK } from '../../theme';
import { StatusBadge } from '../kit/primitives';

/** Follows the pointer and names whatever 3D entity is under it. */
export function HoverTooltip() {
  const hover = useUiStore((s) => s.hover);
  const selection = useUiStore((s) => s.selection);
  const { index } = useReadyData();
  const health = useRepoHealth();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const content = useMemo(() => {
    if (!hover) return null;
    if (selection && selection.kind === hover.kind && 'id' in selection && 'id' in hover && selection.id === hover.id) return null;
    switch (hover.kind) {
      case 'repo': {
        const repo = index.repo.get(hover.id);
        const h = health.get(hover.id);
        if (!repo || !h) return null;
        const signal = h.alert ? 'error' : h.idle ? 'idle' : h.hot ? 'active' : 'success';
        return { eyebrow: 'Repositório', title: repo.name, detail: `${h.openChanges} mudanças abertas`, signal } as const;
      }
      case 'person': {
        const p = index.person.get(hover.id);
        return p ? { eyebrow: 'Pessoa', title: p.displayName, detail: 'Clique para ver participação', signal: null } : null;
      }
      case 'squad': {
        const s = index.squad.get(hover.id);
        return s ? { eyebrow: `Setor ${s.code}`, title: s.name, detail: 'Clique para ver a squad', signal: null } : null;
      }
      case 'gate':
        return { eyebrow: 'Portão', title: 'Produção', detail: 'Só deploys confirmados chegam aqui', signal: null };
      default:
        return null;
    }
  }, [hover, selection, index, health]);

  if (!content || !pos) return null;

  return (
    <div
      role="tooltip"
      className="hud-card pointer-events-none fixed z-50 px-3 py-2"
      style={{ left: pos.x + 14, top: pos.y + 14 }}
    >
      <div className="font-mono text-[10px] font-semibold tracking-[0.12em] text-forge-bright uppercase">{content.eyebrow}</div>
      <div className="font-display text-sm font-semibold text-snow">{content.title}</div>
      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-fog">
        {content.detail}
        {content.signal && <StatusBadge look={SIGNAL_LOOK[content.signal]} />}
      </div>
    </div>
  );
}
