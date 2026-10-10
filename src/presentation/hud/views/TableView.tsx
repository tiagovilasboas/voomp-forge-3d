import { useState } from 'react';
import { PERIOD_OPTIONS } from '@application/queries/period';
import { useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import type { EntityRef } from '../../world/worldModel';
import { Chip, Segmented } from '../kit/primitives';
import { FilterSelect } from './FilterSelect';
import { ModalShell } from './ModalShell';
import { DeliveriesTable, InitiativesTable, PeopleTable, ReposTable, SquadsTable, type TabTableProps } from './TableTabs';
import { useIsDemo } from './viewHooks';

const TABS = [
  { id: 'squads', label: 'Squads', Table: SquadsTable },
  { id: 'repos', label: 'Repositórios', Table: ReposTable },
  { id: 'deliveries', label: 'Entregas', Table: DeliveriesTable },
  { id: 'people', label: 'Pessoas', Table: PeopleTable },
  { id: 'initiatives', label: 'Iniciativas', Table: InitiativesTable },
] as const;

type TabId = (typeof TABS)[number]['id'];

function DataChip() {
  return useIsDemo() ? <Chip tone="demo">DEMO DATA</Chip> : null;
}

function TableBody({ onOpen, notice }: { onOpen?: (ref: EntityRef) => void; notice?: string }) {
  const { snapshot } = useReadyData();
  const periodDays = useUiStore((s) => s.periodDays);
  const squadId = useUiStore((s) => s.squadId);
  const setPeriod = useUiStore((s) => s.setPeriod);
  const setSquad = useUiStore((s) => s.setSquad);
  const [tab, setTab] = useState<TabId>('squads');
  const Active: (props: TabTableProps) => React.ReactNode = TABS.find((t) => t.id === tab)!.Table;

  return (
    <>
      {notice && (
        <p role="status" className="mx-5 mt-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-3">
        <div role="tablist" aria-label="Tipo de dado" className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="table-panel"
              onClick={() => setTab(t.id)}
              className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.id ? 'bg-forge/15 text-forge-bright' : 'text-fog hover:text-snow'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="w-40">
            <FilterSelect label="Squad" value={squadId ?? ''} onChange={(v) => setSquad(v || null)} options={[['', 'Todas as squads'], ...snapshot.squads.map((s): [string, string] => [s.id, s.name])]} />
          </div>
          <Segmented label="Período" value={periodDays} onChange={setPeriod} options={PERIOD_OPTIONS.map((p) => ({ value: p, label: `${p}d` }))} />
        </div>
      </div>
      <div id="table-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-3 flex min-h-0 flex-1 flex-col px-2 pb-2">
        <Active key={tab} onOpen={onOpen} />
      </div>
    </>
  );
}

/** Accessible 2D view of the same data as the 3D world. Overlay by default, full page when `embedded`. */
export function TableView({ embedded = false, notice }: { embedded?: boolean; notice?: string }) {
  const openOverlay = useUiStore((s) => s.openOverlay);
  const select = useUiStore((s) => s.select);

  if (embedded) {
    return (
      <div className="flex h-full w-full flex-col bg-ink-950">
        <header className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2 21 7v10l-9 5-9-5V7z" fill="#FF6A00" />
            <path d="M12 7v10M7.5 9.5 12 12l4.5-2.5" stroke="#090B10" strokeWidth="1.6" fill="none" />
          </svg>
          <h1 className="font-display text-lg font-bold text-snow">Voomp Forge</h1>
          <span className="text-xs text-fog">Visão tabular</span>
          <DataChip />
        </header>
        <TableBody notice={notice} />
      </div>
    );
  }

  const close = () => openOverlay(null);
  return (
    <ModalShell
      title="Visão tabular"
      subtitle="Os mesmos dados do data center em tabelas acessíveis."
      badges={<DataChip />}
      onClose={close}
      closeLabel="Fechar visão tabular"
      className="h-full max-w-7xl"
    >
      <TableBody
        notice={notice}
        onOpen={(ref) => {
          select(ref);
          close();
        }}
      />
    </ModalShell>
  );
}
