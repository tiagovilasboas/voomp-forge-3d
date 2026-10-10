import { useMemo } from 'react';
import type { AllocationMatrix } from '@application/queries/workstreams';
import { useUiStore } from '../../state/uiStore';
import { EmptyState } from '../kit/primitives';
import { ROLE_LABEL } from './frontLabels';

/** The sheet's matrix: people × fronts, cell = role. Planning only: no totals, no scores. */
export function AllocationView({ matrix, visibleIds }: { matrix: AllocationMatrix; visibleIds: Set<string> }) {
  const select = useUiStore((s) => s.select);
  const cols = useMemo(() => matrix.columns.filter((c) => visibleIds.has(c.id)), [matrix, visibleIds]);
  const rows = useMemo(() => matrix.rows.filter((r) => r.assignments.some((a) => visibleIds.has(a.workstreamId))), [matrix, visibleIds]);

  return (
    <div>
      <p className="mb-2 flex items-start gap-1.5 text-[11px] text-fog">
        <strong className="text-snow">Visão de planejamento — não mede desempenho.</strong> Mostra quem está em qual frente e com qual papel.
      </p>
      {rows.length === 0 || cols.length === 0 ? (
        <EmptyState icon="person" title="Nenhuma alocação para este filtro" />
      ) : (
        <div className="scroll-thin max-h-[60dvh] overflow-auto rounded-xl border border-white/[0.08]">
          <table className="border-collapse text-[11px]">
            <caption className="sr-only">Alocação de pessoas por frente (papel de cada pessoa em cada frente)</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky top-0 left-0 z-20 min-w-36 bg-ink-900 px-2 py-1.5 text-left font-semibold text-fog">
                  Pessoa
                </th>
                {cols.map((c) => (
                  <th key={c.id} scope="col" className="sticky top-0 z-10 w-24 min-w-24 bg-ink-900 p-0 text-left align-bottom font-semibold">
                    <button
                      type="button"
                      onClick={() => select({ kind: 'workstream', id: c.id })}
                      title={c.name}
                      className="focus-ring line-clamp-3 h-full w-full px-1.5 py-1.5 text-left text-snow hover:bg-white/[0.06]"
                    >
                      {c.name}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-white/[0.05]">
                  <th scope="row" className="sticky left-0 z-10 bg-ink-900 px-2 py-1 text-left font-medium text-snow">
                    {r.displayName}
                  </th>
                  {cols.map((c) => {
                    const cells = r.assignments.filter((a) => a.workstreamId === c.id);
                    return (
                      <td key={c.id} className="px-1.5 py-1 text-center">
                        {cells.length === 0 ? (
                          <span aria-label="Sem papel nesta frente" className="text-white/15">
                            ·
                          </span>
                        ) : (
                          cells.map((a, i) => (
                            <span key={i} className="mx-0.5 rounded bg-forge/15 px-1.5 py-0.5 font-mono font-semibold text-forge-bright" title={a.specialty ?? undefined}>
                              {ROLE_LABEL[a.role]}
                              {a.specialty && a.role === 'dev' ? ` ${a.specialty}` : ''}
                            </span>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
