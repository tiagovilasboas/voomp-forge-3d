import type { WorkstreamView } from '@application/queries/workstreams';
import { useUiStore } from '../../state/uiStore';
import { Chip, ProgressBar } from '../kit/primitives';
import { HOLO } from '../objects/ObjectScreen';
import { Dependencies, EvidenceChips, FlagRow, LinkList, PlanLine, TeamRows, WsStatusBadge } from './frontParts';

/** One front as a card of the planning-sheet mural. The whole header area opens the detail. */
export function FrontCard({ view }: { view: WorkstreamView }) {
  const select = useUiStore((s) => s.select);
  const { workstream: ws, progress: p } = view;
  const squadNames = view.squads.map((s) => s.name);

  return (
    <article
      aria-label={`Frente ${ws.name}`}
      className="flex flex-col gap-2 rounded-xl border bg-white/[0.04] p-2.5 text-left"
      style={{ borderColor: `${HOLO}2e` }}
    >
      <button
        type="button"
        onClick={() => select({ kind: 'workstream', id: ws.id })}
        aria-label={`Abrir detalhes da frente ${ws.name}`}
        className="focus-ring -m-1 flex flex-col gap-1.5 rounded-lg p-1 text-left transition hover:bg-white/[0.05] tap:min-h-11"
      >
        <span className="font-display text-[13px] leading-snug font-semibold text-snow">{ws.name}</span>
        <span className="flex flex-wrap items-center gap-1">
          <WsStatusBadge status={p.status} />
          <EvidenceChips view={view} />
          <FlagRow view={view} />
        </span>
        {squadNames.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {squadNames.map((n) => (
              <Chip key={n}>{n}</Chip>
            ))}
          </span>
        )}
        <PlanLine ws={ws} replans={p.replans} />
      </button>

      <div className="space-y-1">
        {p.items.total > 0 ? (
          <>
            <div className="flex justify-between text-[11px] text-fog">
              <span>Jira: issues concluídas</span>
              <span className="font-mono text-snow">
                {p.items.done}/{p.items.total}
              </span>
            </div>
            <ProgressBar value={p.items.done / p.items.total} color={p.status === 'delivered' ? 'bg-ok' : 'bg-forge'} />
          </>
        ) : (
          <p className="text-[11px] text-fog">Jira: sem issues vinculadas.</p>
        )}
        <p className="text-[11px] text-fog">
          {p.changes.merged + p.changes.open > 0 ? (
            <>
              Git: <span className="text-snow">{p.changes.merged}</span> integradas · <span className="text-snow">{p.changes.production}</span> em produção
              {p.changes.blocked > 0 && <span className="text-fail"> · {p.changes.blocked} bloqueada(s)</span>}
            </>
          ) : (
            'Git: sem mudanças vinculadas.'
          )}
        </p>
      </div>

      <TeamRows view={view} compact />
      <Dependencies ws={ws} />
      <LinkList ws={ws} />
    </article>
  );
}
