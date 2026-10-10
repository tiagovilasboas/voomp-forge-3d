import { useId, useMemo, useState } from 'react';
import { create } from 'zustand';
import type { DeploymentEnvironment, ID } from '@domain/entities';
import { listDeliveries, type Delivery, type StatusFilter } from '@application/queries/deliveries';
import { PERIOD_OPTIONS, type PeriodDays } from '@application/queries/period';
import { useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { useBreakpoint } from '../kit/useMediaQuery';
import { Chip, EmptyState, Segmented } from '../kit/primitives';
import { DeliveryCard } from './DeliveryCard';
import { ENVIRONMENT_LABEL, STATUS_GROUP_LABEL, STATUS_GROUP_ORDER } from './deliveryLabels';
import { FilterSelect } from './FilterSelect';
import { ModalShell } from './ModalShell';
import { useSnapshotNow, useVocabulary } from './viewHooks';

export interface ExplorerPrefilter {
  status?: StatusFilter | null;
  initiativeId?: string | 'none' | null;
  repoId?: string | null;
  environment?: 'staging' | 'production' | null;
}

interface ExplorerFilters {
  squadId: ID | null;
  periodDays: PeriodDays;
  repoId: ID | null;
  status: StatusFilter | null;
  initiativeId: ID | 'none' | null;
  environment: DeploymentEnvironment | null;
  text: string;
}

interface ExplorerStore extends ExplorerFilters {
  set: <K extends keyof ExplorerFilters>(key: K, value: ExplorerFilters[K]) => void;
  /** Resets the filters to `prefilter` (scope = current squad/period) and opens the overlay. */
  open: (prefilter?: ExplorerPrefilter) => void;
}

/** Filters of the Delivery Explorer. Kept outside the component so panels can open it pre-filtered. */
export const useExplorerFilters = create<ExplorerStore>((setState) => ({
  squadId: null,
  periodDays: 14,
  repoId: null,
  status: null,
  initiativeId: null,
  environment: null,
  text: '',
  set: (key, value) => setState({ [key]: value } as Partial<ExplorerFilters>),
  open: (prefilter = {}) => {
    const ui = useUiStore.getState();
    setState({
      squadId: ui.squadId,
      periodDays: ui.periodDays,
      repoId: prefilter.repoId ?? null,
      status: prefilter.status ?? null,
      initiativeId: prefilter.initiativeId ?? null,
      environment: prefilter.environment ?? null,
      text: '',
    });
    ui.openOverlay('explorer');
  },
}));

const NONE = 'none';

export function DeliveryExplorer() {
  const { snapshot, index } = useReadyData();
  const vocab = useVocabulary();
  const now = useSnapshotNow();
  const filters = useExplorerFilters();
  const { set, squadId, periodDays, repoId, status, initiativeId, environment, text } = filters;

  const phone = useBreakpoint() === 'phone';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const activeFilters = [squadId, repoId, status, initiativeId, environment].filter(Boolean).length;

  const deliveries = useMemo(
    () => listDeliveries(index, { periodDays, squadId, now }, { repoId, status, initiativeId, environment, text }),
    [index, periodDays, squadId, now, repoId, status, initiativeId, environment, text],
  );
  const repos = useMemo(() => snapshot.repositories.filter((r) => !squadId || r.squadId === squadId), [snapshot, squadId]);

  const close = () => useUiStore.getState().openOverlay(null);
  const openDelivery = (d: Delivery) => {
    useUiStore.getState().select({ kind: 'cr', id: d.cr.id });
    close();
  };
  const onSquad = (id: string) => {
    set('squadId', id || null);
    if (repoId && id && index.repo.get(repoId)?.squadId !== id) set('repoId', null);
  };

  return (
    <ModalShell
      title="Delivery Explorer"
      subtitle={`Pergunte aos dados: o que foi entregue, onde parou e por quê. ${vocab.changeRequest}s ligadas às entregas, com evidências.`}
      badges={<Chip tone="demo">{snapshot.source.kind === 'demo' ? 'DEMO DATA' : 'Dados conectados'}</Chip>}
      onClose={close}
      closeLabel="Fechar Delivery Explorer"
    >
      <form
        role="search"
        aria-label="Filtros do Delivery Explorer"
        onSubmit={(e) => e.preventDefault()}
        className="grid grid-cols-2 gap-2 border-b border-white/[0.07] px-4 py-3 md:grid-cols-4 md:px-5 lg:grid-cols-8"
      >
        <label className="col-span-2 flex flex-col gap-1 text-[11px] font-medium text-fog md:col-span-2">
          Busca
          <input
            data-autofocus={phone ? undefined : true}
            type="search"
            value={text}
            onChange={(e) => set('text', e.target.value)}
            placeholder={`Título, #número, repositório…`}
            className="focus-ring rounded-lg border border-white/10 bg-ink-950/60 px-2.5 py-1.5 tap:min-h-11 text-base md:text-xs text-snow placeholder:text-idle"
          />
        </label>
        <div id={filtersId} className={`col-span-2 grid grid-cols-2 gap-2 md:contents ${filtersOpen ? '' : 'max-md:hidden'}`}>
        <FilterSelect label="Squad" value={squadId ?? ''} onChange={onSquad} options={[['', 'Todas'], ...snapshot.squads.map((s): [string, string] => [s.id, s.name])]} />
          <FilterSelect label="Repositório" value={repoId ?? ''} onChange={(v) => set('repoId', v || null)} options={[['', 'Todos'], ...repos.map((r): [string, string] => [r.id, r.name])]} />
          <FilterSelect
            label="Status"
            value={status ?? ''}
            onChange={(v) => set('status', (v || null) as StatusFilter | null)}
            options={[
              ['', 'Todos'],
              ['awaiting_production', 'Aguardando produção (integrado ou staging)'],
              ...STATUS_GROUP_ORDER.map((g): [string, string] => [g, STATUS_GROUP_LABEL[g]]),
            ]}
          />
          <FilterSelect
            label="Iniciativa"
            value={initiativeId ?? ''}
            onChange={(v) => set('initiativeId', v || null)}
            options={[['', 'Todas'], [NONE, 'Sem iniciativa identificada'], ...snapshot.initiatives.map((i): [string, string] => [i.id, `${i.key} · ${i.name}`])]}
          />
          <FilterSelect
            label="Ambiente"
            value={environment ?? ''}
            onChange={(v) => set('environment', (v || null) as DeploymentEnvironment | null)}
            options={[['', 'Todos'], ['staging', ENVIRONMENT_LABEL.staging], ['production', ENVIRONMENT_LABEL.production]]}
          />
          <div className="flex flex-col gap-1 text-[11px] font-medium text-fog">
            Período
            <Segmented
              label="Período"
              value={periodDays}
              onChange={(v) => set('periodDays', v)}
              options={PERIOD_OPTIONS.map((p) => ({ value: p, label: `${p}d` }))}
            />
          </div>
        </div>
      </form>

      <div className="flex items-center justify-between px-4 pt-3 pb-1 text-xs text-fog md:px-5" aria-live="polite">
        <span>
          <strong className="font-display text-sm text-snow">{deliveries.length}</strong> {deliveries.length === 1 ? 'entrega encontrada' : 'entregas encontradas'}
        </span>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen((v) => !v)}
          className="focus-ring ml-auto mr-2 rounded-md px-2 py-1 tap:min-h-11 font-semibold text-snow hover:underline md:hidden"
        >
          Filtros{activeFilters ? ` (${activeFilters})` : ''} {filtersOpen ? '▴' : '▾'}
        </button>
        <button
          type="button"
          onClick={() => useExplorerFilters.getState().open()}
          className="focus-ring rounded-md px-2 py-1 tap:min-h-11 font-semibold text-forge-bright hover:underline"
        >
          Limpar filtros
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto px-4 pt-2 pb-5 md:px-5">
        {deliveries.length === 0 ? (
          <EmptyState icon="search" title="Nenhuma entrega com esses filtros">
            Tente ampliar o período ou limpar os filtros.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {deliveries.map((d) => (
              <li key={d.cr.id}>
                <DeliveryCard delivery={d} onOpen={openDelivery} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}
