import { useMemo } from 'react';
import { listDeliveries, toDelivery, type Delivery } from '@application/queries/deliveries';
import { useReadyData } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';
import { useScope } from '@presentation/state/selectors';
import { STATUS_LOOK } from '@presentation/theme';
import { Card, CardHeader, EmptyState, IconButton, Segmented, StatusBadge } from '@presentation/hud/kit/primitives';
import { StageStepper } from './tracking/StageStepper';

type Mode = 'progress' | 'delivered';

const isDelivered = (d: Delivery) => d.status === 'in_production';

function useTrackedDelivery() {
  const { index } = useReadyData();
  const scope = useScope();
  const trackedCrId = useUiStore((s) => s.trackedCrId);

  return useMemo(() => {
    const all = listDeliveries(index, scope);
    const lists: Record<Mode, Delivery[]> = {
      delivered: all.filter(isDelivered),
      progress: all.filter((d) => !isDelivered(d) && d.status !== 'closed'),
    };
    const tracked = trackedCrId && index.cr.get(trackedCrId) ? toDelivery(index, index.cr.get(trackedCrId)!) : null;
    const current = tracked ?? lists.delivered[0] ?? lists.progress[0] ?? null;
    const mode: Mode = current && isDelivered(current) ? 'delivered' : 'progress';
    return { current, mode, lists };
  }, [index, scope, trackedCrId]);
}

function DeliveryDetail({ delivery }: { delivery: Delivery }) {
  const select = useUiStore((s) => s.select);
  const { cr, repo, initiative, environments } = delivery;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <div className="line-clamp-2 text-[13px] font-semibold text-snow">
        #{cr.number} {cr.title}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-fog">
        {repo.name} → {environments.length ? environments.join(', ') : 'sem deploy'}
      </div>
      <div className="mt-1.5">
        <StatusBadge look={STATUS_LOOK[delivery.status]} />
      </div>
      <div className="mt-1.5 truncate text-[11px] text-fog">
        {initiative ? `${initiative.key} · ${initiative.name}` : 'Iniciativa não identificada'}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs font-semibold">
        <button type="button" onClick={() => select({ kind: 'repo', id: repo.id })} className="focus-ring text-forge-bright hover:underline">
          Ver no mapa →
        </button>
        <button type="button" onClick={() => select({ kind: 'cr', id: cr.id })} className="focus-ring text-forge-bright hover:underline">
          Detalhes
        </button>
      </div>
    </div>
  );
}

/** Follows one change request through its six stages; arrows cycle through the chosen list. */
export function DeliveryTracking() {
  const track = useUiStore((s) => s.track);
  const { current, mode, lists } = useTrackedDelivery();

  const cycle = (step: 1 | -1) => {
    const list = lists[mode];
    if (!list.length) return;
    const at = list.findIndex((d) => d.cr.id === current?.cr.id);
    const next = at === -1 ? (step === 1 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
    track(list[next].cr.id);
  };

  const switchMode = (m: Mode) => {
    const first = lists[m][0];
    if (first) track(first.cr.id);
  };

  return (
    <Card label="Delivery tracking" className="@container">
      {!current ? (
        <>
          <CardHeader title="Delivery tracking" />
          <EmptyState icon="rocket" title="Nenhuma entrega para acompanhar">Ajuste o período ou a squad.</EmptyState>
        </>
      ) : (
        <div className="grid gap-x-4 px-4 pt-3 pb-3 @md:grid-cols-[minmax(0,1fr)_200px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
              <div className="min-w-0">
                <h2 className="font-display text-[13px] font-semibold text-snow">Delivery tracking</h2>
                <div className="truncate font-mono text-[11px] text-fog">
                  #{current.cr.number} · {current.repo.name}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Segmented<Mode>
                  label="Lista de entregas"
                  value={mode}
                  onChange={switchMode}
                  options={[
                    { value: 'progress', label: 'Em andamento', disabled: lists.progress.length === 0 },
                    { value: 'delivered', label: 'Entregues', disabled: lists.delivered.length === 0 },
                  ]}
                />
                <IconButton icon="chevron" label="Entrega anterior" onClick={() => cycle(-1)} className="rotate-180" />
                <IconButton icon="chevron" label="Próxima entrega" onClick={() => cycle(1)} />
              </div>
            </div>
            <div className="mt-3">
              <StageStepper stages={current.stages} />
            </div>
          </div>
          <div className="mt-3 @md:mt-0">
            <DeliveryDetail delivery={current} />
          </div>
        </div>
      )}
    </Card>
  );
}
