import { useMemo } from 'react';
import { useReadyData } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';
import { useRepoHealth } from '@presentation/state/selectors';
import { SIGNAL_LOOK } from '@presentation/theme';
import { EmptyState, IconButton, SectionLabel } from '@presentation/hud/kit/primitives';
import { Icon } from '@presentation/hud/kit/Icon';
import { usePopover } from './usePopover';

/** Bell with a count of repositories that need attention. */
export function AlertsPopover() {
  const { index } = useReadyData();
  const health = useRepoHealth();
  const select = useUiStore((s) => s.select);
  const { open, setOpen, ref } = usePopover();

  const alerts = useMemo(
    () =>
      [...health.values()]
        .filter((h) => h.alert)
        .map((h) => ({
          repo: index.repo.get(h.repoId)!,
          reason: h.modules.find((m) => m.signal === 'error')?.label ?? 'Requer atenção',
        })),
    [health, index],
  );

  return (
    <div ref={ref} className="relative">
      <IconButton icon="bell" label={`Alertas: ${alerts.length}`} onClick={() => setOpen(!open)} active={open} />
      {alerts.length > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-fail px-1 text-[10px] font-bold text-white"
        >
          {alerts.length}
        </span>
      )}
      {open && (
        <div role="dialog" aria-label="Alertas" className="hud-card absolute top-full right-0 z-40 mt-2 w-80 max-w-[calc(100vw-24px)] pb-2">
          <SectionLabel>Repositórios que precisam de atenção</SectionLabel>
          {alerts.length === 0 ? (
            <EmptyState icon="check" title="Tudo certo por aqui">Nenhum alerta no período.</EmptyState>
          ) : (
            <ul className="scroll-thin max-h-72 overflow-auto px-2">
              {alerts.map(({ repo, reason }) => (
                <li key={repo.id}>
                  <button
                    type="button"
                    onClick={() => {
                      select({ kind: 'repo', id: repo.id });
                      setOpen(false);
                    }}
                    className="focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.06]"
                  >
                    <Icon name={SIGNAL_LOOK.error.icon} size={14} className={SIGNAL_LOOK.error.text} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-snow">{repo.name}</span>
                      <span className="block truncate text-[11px] text-fog">{reason}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
