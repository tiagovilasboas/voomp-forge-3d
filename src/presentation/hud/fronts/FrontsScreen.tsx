import { useMemo, useState } from 'react';
import { allocationMatrix, listWorkstreams, workstreamRoadmap, workstreamView } from '@application/queries/workstreams';
import type { WorkstreamCategory } from '@domain/entities';
import type { WorkstreamStatus } from '@domain/rules/workstreamProgress';
import { useReadyData } from '../../state/dataStore';
import { useScope } from '../../state/selectors';
import { useUiStore } from '../../state/uiStore';
import { Chip, EmptyState } from '../kit/primitives';
import { FilterSelect } from '../views/FilterSelect';
import { HOLO, ObjectScreen } from '../objects/ObjectScreen';
import { AllocationView } from './AllocationView';
import { FrontCard } from './FrontCard';
import { CATEGORY_LABEL, CATEGORY_ORDER, WS_STATUS_LOOK, WS_STATUS_ORDER } from './frontLabels';
import { RoadmapView } from './RoadmapView';
import { WorkstreamDetail } from './WorkstreamDetail';

type Tab = 'mural' | 'roadmap' | 'allocation';
const TABS: { id: Tab; label: string }[] = [
  { id: 'mural', label: 'Mural' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'allocation', label: 'Alocação' },
];

/**
 * "Mural de Frentes": the team's planning sheet turned visual. Also hosts the detail pane of a
 * single front (selection `workstream`), so the tab and filters survive going back and forth.
 */
export function FrontsScreen() {
  const { index, snapshot } = useReadyData();
  const scope = useScope();
  const selection = useUiStore((s) => s.selection);
  const [tab, setTab] = useState<Tab>('mural');
  const [squadId, setSquadId] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');

  const views = useMemo(
    () =>
      listWorkstreams(index, scope, {
        squadId: squadId || null,
        status: (status || null) as WorkstreamStatus | null,
        category: (category || null) as WorkstreamCategory | null,
      }),
    [index, scope, squadId, status, category],
  );
  const visibleIds = useMemo(() => new Set(views.map((v) => v.workstream.id)), [views]);
  const roadmap = useMemo(() => workstreamRoadmap(index, scope).filter((e) => visibleIds.has(e.workstream.id)), [index, scope, visibleIds]);
  const matrix = useMemo(() => allocationMatrix(index), [index]);

  const detailId = selection?.kind === 'workstream' ? selection.id : null;
  const detailWs = detailId ? snapshot.workstreams.find((w) => w.id === detailId) : undefined;
  const detail = useMemo(() => (detailWs ? workstreamView(index, detailWs, scope) : null), [index, detailWs, scope]);

  const squadLabel = squadId ? index.squad.get(squadId)?.name : scope.squadId ? index.squad.get(scope.squadId)?.name : null;

  return (
    <ObjectScreen
      icon="target"
      title={detailId ? (detailWs?.name ?? 'Frente') : 'Mural de Frentes'}
      subtitle={detailId ? 'Frente · detalhes' : `A planilha de planejamento, com evidência do Jira e do Git${squadLabel ? ` · ${squadLabel}` : ''}`}
      actions={<Chip tone="demo">{snapshot.source.kind === 'demo' ? 'DEMO DATA' : 'dados reais'}</Chip>}
    >
      {detailId ? (
        detail ? (
          <WorkstreamDetail view={detail} />
        ) : (
          <EmptyState icon="help" title="Item não encontrado nos dados atuais" />
        )
      ) : (
        <div className="p-3 md:p-4">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div role="tablist" aria-label="Visões do mural" className="inline-flex rounded-lg bg-white/[0.05] p-0.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`fronts-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="fronts-panel"
                  onClick={() => setTab(t.id)}
                  className={`focus-ring rounded-md px-4 py-1.5 text-xs font-semibold transition tap:min-h-10 ${tab === t.id ? 'text-ink-950' : 'text-fog hover:text-snow'}`}
                  style={tab === t.id ? { background: HOLO } : undefined}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3 md:max-w-xl">
              <FilterSelect
                label="Squad"
                value={squadId}
                onChange={setSquadId}
                options={[['', scope.squadId ? 'Squad do filtro global' : 'Todas as squads'], ...snapshot.squads.map((s): [string, string] => [s.id, s.name])]}
              />
              <FilterSelect label="Status" value={status} onChange={setStatus} options={[['', 'Todos'], ...WS_STATUS_ORDER.map((s): [string, string] => [s, WS_STATUS_LOOK[s].label])]} />
              <FilterSelect
                label="Categoria"
                value={category}
                onChange={setCategory}
                options={[['', 'Todas'], ...CATEGORY_ORDER.map((c): [string, string] => [c, CATEGORY_LABEL[c]])]}
              />
            </div>
            <span className="text-[11px] text-fog" aria-live="polite">
              {views.length} {views.length === 1 ? 'frente' : 'frentes'}
            </span>
          </div>

          <div id="fronts-panel" role="tabpanel" aria-labelledby={`fronts-tab-${tab}`}>
            {tab === 'mural' &&
              (views.length === 0 ? (
                <EmptyState icon="target" title="Nenhuma frente para este filtro">
                  Ajuste a squad, o status ou a categoria.
                </EmptyState>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {CATEGORY_ORDER.map((c) => {
                    const col = views.filter((v) => v.workstream.category === c);
                    if (category && c !== category) return null;
                    return (
                      <section key={c} aria-label={CATEGORY_LABEL[c]} className="min-w-0 space-y-2">
                        <h3 className="flex items-center justify-between border-b pb-1 font-mono text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: HOLO, borderColor: `${HOLO}33` }}>
                          {CATEGORY_LABEL[c]}
                          <span className="text-fog">{col.length}</span>
                        </h3>
                        {col.length === 0 && <p className="text-[11px] text-fog">Nenhuma frente aqui.</p>}
                        {col.map((v) => (
                          <FrontCard key={v.workstream.id} view={v} />
                        ))}
                      </section>
                    );
                  })}
                </div>
              ))}
            {tab === 'roadmap' && <RoadmapView entries={roadmap} scope={scope} />}
            {tab === 'allocation' && <AllocationView matrix={matrix} visibleIds={visibleIds} />}
          </div>
        </div>
      )}
    </ObjectScreen>
  );
}
