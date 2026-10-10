import type { WorkstreamView } from '@application/queries/workstreams';
import { STATUS_LOOK } from '../../theme';
import { useUiStore } from '../../state/uiStore';
import { EvidenceLink } from '../kit/EvidenceLink';
import { Icon } from '../kit/Icon';
import { Chip, SectionLabel, StatusBadge } from '../kit/primitives';
import { useVocabulary } from '../views/viewHooks';
import { CATEGORY_LABEL, shortDate, summarize } from './frontLabels';
import { Dependencies, EvidenceChips, FlagRow, LinkList, TeamRows, WsStatusBadge } from './frontParts';

/** Detail pane of one front, shown inside the Fronts Object Screen. */
export function WorkstreamDetail({ view }: { view: WorkstreamView }) {
  const select = useUiStore((s) => s.select);
  const vocab = useVocabulary();
  const { workstream: ws, progress: p } = view;

  return (
    <div className="space-y-3 p-3 md:p-4">
      <button
        type="button"
        onClick={() => select({ kind: 'fronts' })}
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-snow hover:bg-white/[0.12] tap:min-h-11"
      >
        <Icon name="chevron" size={14} className="rotate-180" />
        Voltar ao Mural de Frentes
      </button>

      <section aria-label="Resumo" className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <WsStatusBadge status={p.status} />
          <EvidenceChips view={view} />
          <FlagRow view={view} />
          <Chip>{CATEGORY_LABEL[ws.category]}</Chip>
          {view.squads.map((s) => (
            <Chip key={s.id}>{s.name}</Chip>
          ))}
        </div>
        <p className="mt-2 text-[13px] leading-snug text-snow">{summarize(view)}</p>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section aria-label="Linha do tempo dos planos" className="rounded-xl border border-white/[0.08] bg-white/[0.03] pb-3">
          <SectionLabel>Planos</SectionLabel>
          {ws.plans.length === 0 ? (
            <p className="px-4 text-[11px] text-fog">Sem plano registrado.</p>
          ) : (
            <ol className="space-y-2 px-4">
              {ws.plans.map((pl, i) => {
                const current = i === ws.plans.length - 1;
                return (
                  <li key={i} className="flex items-start gap-2 text-[12px]">
                    <span aria-hidden className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-forge ${current ? 'bg-forge' : ''}`} />
                    <span>
                      <span className={current ? 'font-semibold text-snow' : 'text-fog line-through'}>{pl.label}</span>
                      <span className="block text-[11px] text-fog">
                        {pl.target ? `meta ${shortDate(pl.target)}` : 'sem data comprometida'} · registrado em {shortDate(pl.recordedAt)}
                        {current ? ' · plano atual' : ' · plano anterior'}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-label="Time" className="rounded-xl border border-white/[0.08] bg-white/[0.03] pb-3">
          <SectionLabel>Time da frente</SectionLabel>
          <div className="px-4">
            <TeamRows view={view} />
            <p className="mt-2 text-[10px] text-fog">Visão de planejamento — não mede desempenho.</p>
          </div>
        </section>
      </div>

      {(ws.dependencies.length > 0 || ws.links.length > 0 || ws.notes.length > 0) && (
        <section aria-label="Dependências e links" className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <Dependencies ws={ws} />
          <LinkList ws={ws} />
          {ws.notes.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-fog">
              {ws.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-label="Issues do Jira" className="rounded-xl border border-white/[0.08] bg-white/[0.03] pb-2">
        <SectionLabel aside={<span>{p.items.done}/{p.items.total} concluídas</span>}>Issues no Jira</SectionLabel>
        {view.workItems.length === 0 ? (
          <p className="px-4 pb-1 text-[11px] text-fog">Nenhuma issue vinculada aos épicos desta frente.</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {view.workItems.map((w) => (
              <li key={w.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-1.5 text-[12px]">
                {w.url ? <EvidenceLink href={w.url}>{w.key}</EvidenceLink> : <span className="font-mono text-fog">{w.key}</span>}
                <span className="min-w-0 flex-1 basis-40 text-snow">{w.title}</span>
                <Chip tone={w.status === 'done' ? 'forge' : 'neutral'}>{w.statusName}</Chip>
                <span className={`text-[11px] ${w.productionAt ? 'text-ok' : 'text-fog'}`}>
                  {w.productionAt ? `em produção ${shortDate(w.productionAt)}` : 'sem produção no Jira'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Mudanças vinculadas" className="rounded-xl border border-white/[0.08] bg-white/[0.03] pb-2">
        <SectionLabel>Mudanças no Git</SectionLabel>
        {view.changes.length === 0 ? (
          <p className="px-4 pb-1 text-[11px] text-fog">Nenhuma mudança vinculada a esta frente.</p>
        ) : (
          <ul>
            {view.changes.map((d) => (
              <li key={d.cr.id}>
                <button
                  type="button"
                  onClick={() => select({ kind: 'cr', id: d.cr.id })}
                  aria-label={`Abrir ${vocab.changeRequestShort} #${d.cr.number}`}
                  className="focus-ring flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-1.5 text-left text-[12px] hover:bg-white/[0.06] tap:min-h-11"
                >
                  <span className="font-mono text-fog">#{d.cr.number}</span>
                  <span className="min-w-0 flex-1 basis-40 text-snow">{d.cr.productSummary ?? d.cr.title}</span>
                  <StatusBadge look={STATUS_LOOK[d.status]} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
