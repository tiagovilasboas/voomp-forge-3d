import { useMemo, useState } from 'react';
import { listDeliveries, type Delivery } from '@application/queries/deliveries';
import type { DeliveryStatus } from '@domain/rules/changeRequestProgress';
import { useReadyData } from '../../state/dataStore';
import { useScope } from '../../state/selectors';
import { useUiStore } from '../../state/uiStore';
import { STATUS_LOOK } from '../../theme';
import { relativeTime } from '../kit/format';
import { Chip, EmptyState, StatusBadge } from '../kit/primitives';
import { useSnapshotNow, useVocabulary } from '../views/viewHooks';
import { HOLO, ObjectScreen } from './ObjectScreen';

type Tab = 'changes' | 'deliveries';

interface Group {
  title: string;
  statuses: DeliveryStatus[];
  empty: string;
}

function parseId(id: string): { squadId: string; tab: Tab } {
  const i = id.lastIndexOf(':');
  const tab = id.slice(i + 1) === 'deliveries' ? 'deliveries' : 'changes';
  return { squadId: i < 0 ? id : id.slice(0, i), tab };
}

export function BoardScreen({ id }: { id: string }) {
  const parsed = useMemo(() => parseId(id), [id]);
  const { index } = useReadyData();
  const scope = useScope();
  const now = useSnapshotNow();
  const vocab = useVocabulary();
  const select = useUiStore((s) => s.select);
  const [tab, setTab] = useState<Tab>(parsed.tab);
  const squad = index.squad.get(parsed.squadId);

  const deliveries = useMemo(() => (squad ? listDeliveries(index, { ...scope, squadId: squad.id }) : []), [index, scope, squad]);

  const groups: Group[] =
    tab === 'changes'
      ? [
          { title: 'Aguardando revisão', statuses: ['awaiting_review'], empty: 'Nenhuma mudança aguardando revisão.' },
          { title: 'Ajustes solicitados', statuses: ['changes_requested'], empty: 'Nenhum ajuste solicitado.' },
          { title: `${vocab.pipeline} falhou`, statuses: ['ci_failed'], empty: 'Nenhuma falha.' },
          { title: 'Aprovadas', statuses: ['approved'], empty: 'Nenhuma aprovada aguardando integração.' },
          { title: 'Rascunhos', statuses: ['draft'], empty: 'Nenhum rascunho.' },
        ]
      : [
          { title: 'Em produção', statuses: ['in_production'], empty: 'Nada em produção no período.' },
          { title: 'Em staging', statuses: ['in_staging'], empty: 'Nada em staging.' },
          { title: 'Integradas sem deploy', statuses: ['merged'], empty: 'Nada integrado aguardando deploy.' },
        ];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'changes', label: 'Mudanças' },
    { id: 'deliveries', label: 'Entregas' },
  ];

  return (
    <ObjectScreen
      icon="pipeline"
      title={squad ? `${tab === 'changes' ? 'Quadro de mudanças' : 'Quadro de entregas'} · ${squad.name}` : 'Quadro da squad'}
      subtitle={squad ? `SQ-${squad.code}` : undefined}
      actions={<Chip tone="forge">últimos {scope.periodDays} dias</Chip>}
    >
      {!squad ? (
        <EmptyState icon="help" title="Item não encontrado nos dados atuais" />
      ) : (
        <div className="p-3 md:p-4">
          <div role="tablist" aria-label="Quadros da squad" className="mb-3 inline-flex rounded-lg bg-white/[0.05] p-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`board-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="board-panel"
                onClick={() => setTab(t.id)}
                className={`focus-ring rounded-md px-4 py-1.5 text-xs font-semibold transition tap:min-h-10 ${tab === t.id ? 'text-ink-950' : 'text-fog hover:text-snow'}`}
                style={tab === t.id ? { background: HOLO } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div id="board-panel" role="tabpanel" aria-labelledby={`board-tab-${tab}`} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => {
              const items = deliveries.filter((d) => g.statuses.includes(d.status));
              return (
                <section key={g.title} aria-label={g.title} className="rounded-xl border bg-white/[0.03] p-2.5" style={{ borderColor: `${HOLO}33` }}>
                  <h3 className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: HOLO }}>
                    {g.title}
                    <span className="text-fog">{items.length}</span>
                  </h3>
                  {items.length === 0 && <p className="px-1 py-1 text-[11px] text-fog">{g.empty}</p>}
                  <ul className="space-y-0.5">
                    {items.map((d) => (
                      <Row key={d.cr.id} d={d} short={vocab.changeRequestShort} now={now} onOpen={() => select({ kind: 'cr', id: d.cr.id })} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </ObjectScreen>
  );
}

function Row({ d, short, now, onOpen }: { d: Delivery; short: string; now: Date; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir ${short} #${d.cr.number}`}
        className="focus-ring flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.07] tap:min-h-11"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-snow">
            {short} #{d.cr.number} · {d.cr.productSummary ?? d.cr.title}
          </span>
          <span className="block truncate text-[11px] text-fog">
            {d.repo.name} · {relativeTime(d.lastActivityAt, now)}
          </span>
        </span>
        <StatusBadge look={STATUS_LOOK[d.status]} compact />
      </button>
    </li>
  );
}
