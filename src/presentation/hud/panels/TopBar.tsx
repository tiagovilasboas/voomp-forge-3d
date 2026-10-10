import { useUiStore, type ViewMode } from '@presentation/state/uiStore';
import { PERIOD_OPTIONS, type PeriodDays } from '@application/queries/period';
import { Segmented } from '@presentation/hud/kit/primitives';
import { Icon } from '@presentation/hud/kit/Icon';
import { ForgeLogo } from './topbar/ForgeLogo';
import { SquadSelect } from './topbar/SquadSelect';
import { SourceStatus } from './topbar/SourceStatus';
import { GlobalSearch } from './topbar/GlobalSearch';
import { AlertsPopover } from './topbar/AlertsPopover';
import { SettingsPopover } from './topbar/SettingsPopover';

/** Top bar: identity, scope filters, view mode, search, alerts, settings and the Explorer CTA. */
export function TopBar() {
  const periodDays = useUiStore((s) => s.periodDays);
  const setPeriod = useUiStore((s) => s.setPeriod);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const openOverlay = useUiStore((s) => s.openOverlay);

  return (
    <header aria-label="Barra superior" className="hud-card relative z-30 flex h-[52px] items-center gap-2 px-3">
      <ForgeLogo />
      <SquadSelect />
      <SourceStatus />
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="hidden sm:block">
          <Segmented<PeriodDays>
            label="Período"
            value={periodDays}
            onChange={setPeriod}
            options={PERIOD_OPTIONS.map((d) => ({ value: d, label: `${d}d` }))}
          />
        </div>
        <div className="hidden md:block">
          <Segmented<ViewMode>
            label="Modo de visão"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'product', label: 'Product View' },
              { value: 'engineering', label: 'Engineering View' },
            ]}
          />
        </div>
        <GlobalSearch />
        <AlertsPopover />
        <SettingsPopover />
        <button
          type="button"
          onClick={() => openOverlay('explorer')}
          className="focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-forge px-3 text-[13px] font-semibold text-ink-950 transition hover:bg-forge-bright"
        >
          <Icon name="search" size={14} />
          <span className="hidden sm:inline">Delivery Explorer</span>
        </button>
      </div>
    </header>
  );
}
