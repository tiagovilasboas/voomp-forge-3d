import { PERIOD_OPTIONS, type PeriodDays } from '@application/queries/period';
import { useUiStore } from '@presentation/state/uiStore';
import { useExplorerFilters } from '../views/DeliveryExplorer';
import { Legend } from '../views/Legend';
import { ModeCard } from '../panels/LeftColumn';
import { AlertsList } from '../panels/topbar/AlertsPopover';
import { MenuButton, SettingsPanel } from '../panels/topbar/SettingsPopover';
import { SourceStatus } from '../panels/topbar/SourceStatus';
import { Card, CardHeader, Segmented } from '../kit/primitives';

/** Phone "Mais" sheet: everything the top bar and map controls hold on larger screens. */
export function MoreContent() {
  const periodDays = useUiStore((s) => s.periodDays);
  const setPeriod = useUiStore((s) => s.setPeriod);
  const openOverlay = useUiStore((s) => s.openOverlay);
  const setTourStep = useUiStore((s) => s.setTourStep);
  const setTab = useUiStore((s) => s.setMobileTab);

  const run = (fn: () => void) => () => {
    setTab('map');
    fn();
  };

  return (
    <div className="space-y-3 p-3">
      <ModeCard />
      <Card label="Período">
        <CardHeader title="Período" />
        <div className="px-4 pb-3">
          <Segmented<PeriodDays>
            label="Período"
            value={periodDays}
            onChange={setPeriod}
            options={PERIOD_OPTIONS.map((d) => ({ value: d, label: `${d}d` }))}
          />
        </div>
      </Card>
      <Card label="Explorar">
        <CardHeader title="Explorar" />
        <div className="px-2 pb-2">
          <MenuButton label="Delivery Explorer" onClick={run(() => useExplorerFilters.getState().open())} />
          <MenuButton label="Visão tabular" onClick={run(() => openOverlay('table'))} />
          <MenuButton label="Tour guiado" onClick={run(() => setTourStep(0))} />
          <MenuButton label="Rever boas-vindas" onClick={run(() => openOverlay('welcome'))} />
        </div>
      </Card>
      <Card label="Alertas">
        <CardHeader title="Alertas" />
        <div className="pb-2">
          <AlertsList onPick={() => setTab('map')} />
        </div>
      </Card>
      <Card label="Legenda">
        <CardHeader title="Legenda" />
        <div className="px-3 pb-3">
          <Legend />
        </div>
      </Card>
      <Card label="Configurações">
        <CardHeader title="Configurações" />
        <div className="px-2 pb-2">
          <SettingsPanel />
          <div className="px-2 pt-2 pb-1">
            <SourceStatus expanded />
          </div>
        </div>
      </Card>
    </div>
  );
}
