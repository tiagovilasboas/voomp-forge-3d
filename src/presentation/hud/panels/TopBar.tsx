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
import { ActivityPopover } from './topbar/ActivityPopover';
import { PhoneTopBar } from './topbar/PhoneTopBar';
import { useBreakpoint } from '../kit/useMediaQuery';

/** Top bar: identity, scope filters, view mode, search, alerts, settings and the Explorer CTA. */
export function TopBar() {
  const breakpoint = useBreakpoint();
  return breakpoint === 'phone' ? <PhoneTopBar /> : <WideTopBar tablet={breakpoint === 'tablet'} />;
}

function WideTopBar({ tablet }: { tablet: boolean }) {
  const leftDrawerOpen = useUiStore((s) => s.leftDrawerOpen);
  const setLeftDrawerOpen = useUiStore((s) => s.setLeftDrawerOpen);
  const periodDays = useUiStore((s) => s.periodDays);
  const setPeriod = useUiStore((s) => s.setPeriod);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const openOverlay = useUiStore((s) => s.openOverlay);

  return (
    <header aria-label="Barra superior" className="hud-card relative z-30 flex h-[52px] items-center gap-2 px-3">
      {tablet && (
        <button
          type="button"
          aria-label="Painel lateral"
          aria-expanded={leftDrawerOpen}
          aria-controls="left-drawer"
          onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
          className={`focus-ring grid h-8 w-8 tap:h-11 tap:w-11 shrink-0 place-items-center rounded-lg transition hover:bg-white/[0.08] ${leftDrawerOpen ? 'bg-forge/15 text-forge-bright' : 'text-fog'}`}
        >
          <Icon name="squad" size={16} />
        </button>
      )}
      <ForgeLogo />
      <SquadSelect />
      <SourceStatus />
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div>
          <Segmented<PeriodDays>
            label="Período"
            value={periodDays}
            onChange={setPeriod}
            options={PERIOD_OPTIONS.map((d) => ({ value: d, label: `${d}d` }))}
          />
        </div>
        <div className="hidden xl:block">
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
        {tablet && <ActivityPopover />}
        <AlertsPopover />
        <SettingsPopover />
        <button
          type="button"
          onClick={() => openOverlay('explorer')}
          className="focus-ring flex h-8 tap:h-11 shrink-0 items-center gap-1.5 rounded-lg bg-forge px-3 text-[13px] font-semibold text-ink-950 transition hover:bg-forge-bright"
        >
          <Icon name="search" size={14} />
          <span className="sr-only xl:hidden">Delivery Explorer</span>
          <span className="hidden xl:inline">Delivery Explorer</span>
        </button>
      </div>
    </header>
  );
}
