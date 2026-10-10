import { useMemo } from 'react';
import { listWorkstreams } from '@application/queries/workstreams';
import { useReadyData } from '@presentation/state/dataStore';
import { useScope } from '@presentation/state/selectors';
import { useUiStore } from '@presentation/state/uiStore';
import { Card, CardHeader, EmptyState } from '@presentation/hud/kit/primitives';
import { WS_STATUS_ORDER } from '../../fronts/frontLabels';
import { WsStatusBadge } from '../../fronts/frontParts';
import { ListRow } from './ListRow';

/** Product View: the four fronts that need attention first, and the way into the full mural. */
export function FrontsCard() {
  const { index } = useReadyData();
  const scope = useScope();
  const select = useUiStore((s) => s.select);
  const { top, total } = useMemo(() => {
    const all = listWorkstreams(index, scope);
    const sorted = [...all].sort((a, b) => WS_STATUS_ORDER.indexOf(a.progress.status) - WS_STATUS_ORDER.indexOf(b.progress.status));
    return { top: sorted.slice(0, 4), total: all.length };
  }, [index, scope]);

  return (
    <Card label="Frentes">
      <CardHeader title="Frentes" aside={<span className="text-[11px] text-fog">por risco · {total} no total</span>} />
      {top.length === 0 ? (
        <EmptyState icon="target" title="Nenhuma frente cadastrada" />
      ) : (
        <ul>
          {top.map((v) => (
            <li key={v.workstream.id}>
              <ListRow onClick={() => select({ kind: 'workstream', id: v.workstream.id })} label={`Abrir frente ${v.workstream.name}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-snow">{v.workstream.name}</span>
                  <WsStatusBadge status={v.progress.status} />
                </div>
              </ListRow>
            </li>
          ))}
        </ul>
      )}
      <div className="px-4 pt-1 pb-3">
        <button
          type="button"
          onClick={() => select({ kind: 'fronts' })}
          className="focus-ring w-full rounded-lg bg-forge/15 px-3 py-1.5 text-xs font-semibold text-forge-bright hover:bg-forge/25 tap:min-h-11"
        >
          Abrir mural
        </button>
      </div>
    </Card>
  );
}
