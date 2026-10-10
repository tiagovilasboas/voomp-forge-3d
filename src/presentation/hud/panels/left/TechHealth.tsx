import { useMemo } from 'react';
import { useReadyData } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';
import { useRepoHealth } from '@presentation/state/selectors';
import { SIGNAL_LOOK } from '@presentation/theme';
import type { Signal } from '@application/queries/repositoryHealth';
import { Card, CardHeader } from '@presentation/hud/kit/primitives';
import { Icon } from '@presentation/hud/kit/Icon';
import { ListRow } from './ListRow';

interface HealthGroup {
  id: string;
  label: string;
  signal: Signal;
  repos: { id: string; name: string; detail?: string }[];
}

const MAX_REPOS_PER_GROUP = 4;

function useHealthGroups(): HealthGroup[] {
  const { snapshot } = useReadyData();
  const health = useRepoHealth();
  const squadId = useUiStore((s) => s.squadId);
  return useMemo(() => {
    const rows = snapshot.repositories
      .filter((r) => !squadId || r.squadId === squadId)
      .map((r) => ({ repo: r, h: health.get(r.id)! }));
    const pick = (test: (h: (typeof rows)[number]['h']) => boolean, detail?: (h: (typeof rows)[number]['h']) => string) =>
      rows.filter(({ h }) => test(h)).map(({ repo, h }) => ({ id: repo.id, name: repo.name, detail: detail?.(h) }));
    return [
      { id: 'ci', label: 'Pipeline falhando', signal: 'error', repos: pick((h) => h.pipeline.signal === 'error') },
      {
        id: 'blocked',
        label: 'Mudanças bloqueadas',
        signal: 'error',
        repos: pick((h) => h.blockedChanges > 0, (h) => `${h.blockedChanges}`),
      },
      { id: 'nodata', label: 'Sem dados de pipeline', signal: 'unknown', repos: pick((h) => h.pipeline.signal === 'unknown') },
      { id: 'idle', label: 'Sem atividade no período', signal: 'idle', repos: pick((h) => h.idle) },
    ];
  }, [snapshot, health, squadId]);
}

/** Engineering View: where to look first. Each repository opens its inspector. */
export function TechHealth() {
  const groups = useHealthGroups();
  const select = useUiStore((s) => s.select);

  return (
    <Card label="Saúde técnica">
      <CardHeader title="Saúde técnica" />
      <div className="pb-2">
        {groups.map((g) => {
          const look = SIGNAL_LOOK[g.signal];
          return (
            <section key={g.id} aria-label={g.label}>
              <div className={`flex items-center gap-1.5 px-4 pt-2 pb-0.5 text-[11px] font-semibold ${look.text}`}>
                <Icon name={look.icon} size={12} />
                <span>{g.label}</span>
                <span className="ml-auto font-display text-sm">{g.repos.length}</span>
              </div>
              {g.repos.length === 0 && <div className="px-4 pb-1 text-[11px] text-fog">Nenhum repositório.</div>}
              {g.repos.slice(0, MAX_REPOS_PER_GROUP).map((r) => (
                <ListRow key={r.id} onClick={() => select({ kind: 'repo', id: r.id })} label={`${r.name}, ${g.label}`}>
                  <div className="flex items-center justify-between gap-2 text-[13px] text-snow">
                    <span className="truncate">{r.name}</span>
                    {r.detail && <span className="font-mono text-[11px] text-fog">{r.detail}</span>}
                  </div>
                </ListRow>
              ))}
              {g.repos.length > MAX_REPOS_PER_GROUP && (
                <div className="px-4 text-[11px] text-fog">+{g.repos.length - MAX_REPOS_PER_GROUP} repositórios</div>
              )}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
