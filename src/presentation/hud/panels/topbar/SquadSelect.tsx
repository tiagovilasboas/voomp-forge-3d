import { useMemo } from 'react';
import { useReadyData } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';

/** Organisation/squad selector (native select, styled). */
export function SquadSelect() {
  const { snapshot, index } = useReadyData();
  const squadId = useUiStore((s) => s.squadId);
  const setSquad = useUiStore((s) => s.setSquad);

  const { code, name, repos, people } = useMemo(() => {
    const squad = squadId ? index.squad.get(squadId) : null;
    return {
      code: squad ? `SQ-${squad.code}` : 'TODAS',
      name: squad ? squad.name : 'Todas as squads',
      repos: squad ? (index.reposBySquad.get(squad.id)?.length ?? 0) : snapshot.repositories.length,
      people: squad ? (index.peopleBySquad.get(squad.id)?.length ?? 0) : snapshot.contributors.length,
    };
  }, [squadId, index, snapshot]);

  return (
    <div className="relative flex min-w-0 shrink items-center gap-2 rounded-xl bg-white/[0.04] py-1 pr-7 pl-1.5 tap:min-h-11 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forge-bright hover:bg-white/[0.07]">
      <span className="rounded-md bg-forge px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink-950">{code}</span>
      <div className="hidden min-w-0 leading-tight lg:block">
        <div className="truncate text-[13px] font-semibold text-snow">{name}</div>
        <div className="hidden truncate text-[11px] text-fog xl:block">
          {repos} repositórios · {people} pessoas
        </div>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute right-2 text-[10px] text-fog">▾</span>
      <select
        aria-label="Filtrar por squad"
        value={squadId ?? ''}
        onChange={(e) => setSquad(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">Todas as squads</option>
        {snapshot.squads.map((s) => (
          <option key={s.id} value={s.id}>
            SQ-{s.code} · {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
