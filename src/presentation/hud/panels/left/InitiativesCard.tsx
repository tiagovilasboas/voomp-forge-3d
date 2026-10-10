import { useMemo } from 'react';
import { initiativeSummaries } from '@application/queries/initiatives';
import { useReadyData } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';
import { useScope } from '@presentation/state/selectors';
import { Card, CardHeader, Chip, EmptyState, ProgressBar } from '@presentation/hud/kit/primitives';
import { ListRow } from './ListRow';

/** Initiatives with how much of their work is confirmed in production. */
export function InitiativesCard() {
  const { index } = useReadyData();
  const scope = useScope();
  const selection = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);
  const summaries = useMemo(() => initiativeSummaries(index, scope), [index, scope]);

  return (
    <Card label="Iniciativas">
      <CardHeader title="Iniciativas" aside={<span className="text-[11px] text-fog">em produção / total</span>} />
      {summaries.length === 0 ? (
        <EmptyState icon="target" title="Nenhuma iniciativa cadastrada" />
      ) : (
        <ul className="pb-2">
          {summaries.map((s) => {
            const total = s.deliveries.length;
            const selected = selection?.kind === 'initiative' && selection.id === s.initiative.id;
            return (
              <li key={s.initiative.id}>
                <ListRow onClick={() => select({ kind: 'initiative', id: s.initiative.id })} selected={selected}>
                  <div className="flex items-center gap-2">
                    <Chip tone="forge">{s.initiative.key}</Chip>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-snow">{s.initiative.name}</span>
                    <span className="font-mono text-[11px] text-fog">
                      {s.inProduction.length}/{total}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={total ? s.inProduction.length / total : 0} />
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-fog">{s.headline}</div>
                </ListRow>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
