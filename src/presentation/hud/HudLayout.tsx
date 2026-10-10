import { useUiStore } from '../state/uiStore';
import { TopBar } from './panels/TopBar';
import { KpiStrip } from './panels/KpiStrip';
import { LeftColumn } from './panels/LeftColumn';
import { Inspector } from './panels/Inspector';
import { MapControls } from './panels/MapControls';
import { ActivityTabs } from './panels/ActivityTabs';
import { DeliveryTracking } from './panels/DeliveryTracking';
import { HoverTooltip } from './panels/HoverTooltip';
import { Legend } from './views/Legend';
import { DeliveryExplorer } from './views/DeliveryExplorer';
import { TableView } from './views/TableView';
import { TourCoach, WelcomeModal } from './views/WelcomeModal';

/**
 * Screen regions (same arrangement as the WareTrack reference):
 *
 *  ┌ TopBar ───────────────────────────────────────────────────────────┐
 *  │ KPI strip                                    [map ctl] Inspector  │
 *  │ Left column                                                       │
 *  │ (Product questions · Initiatives · View)          3D world        │
 *  │                                                                   │
 *  │ Delivery tracking            Legend              Activity tabs    │
 *  └───────────────────────────────────────────────────────────────────┘
 *
 * The overlay ignores pointer events; only cards capture them, so the world
 * stays explorable between panels.
 */
export function HudLayout() {
  const hasSelection = useUiStore((s) => s.selection !== null);
  const overlay = useUiStore((s) => s.overlay);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto">
      <div className="absolute inset-x-3 top-3">
        <TopBar />
      </div>

      <div className="absolute top-[72px] left-3 max-w-[calc(100vw-24px)] lg:max-w-[calc(100vw-400px)]">
        <KpiStrip />
      </div>

      <div className="absolute top-[156px] bottom-[206px] left-3 hidden w-[272px] lg:block">
        <LeftColumn />
      </div>

      <div className={`absolute top-[156px] hidden md:block lg:top-[72px] ${hasSelection ? 'right-[356px]' : 'right-3'}`}>
        <MapControls />
      </div>

      {hasSelection && (
        <div className="absolute inset-x-3 bottom-3 max-h-[62vh] md:inset-x-auto md:top-[156px] md:right-3 md:bottom-auto md:w-[332px] lg:top-[72px]">
          <Inspector />
        </div>
      )}

      <div className="absolute bottom-3 left-3 hidden w-[min(560px,calc(100vw-360px))] md:block">
        <DeliveryTracking />
      </div>

      <div className="pointer-events-none absolute right-[336px] bottom-3 left-[584px] hidden justify-center xl:flex [&>*]:pointer-events-auto">
        <Legend />
      </div>

      {!hasSelection && (
        <div className="absolute right-3 bottom-3 hidden h-[290px] w-[312px] md:block">
          <ActivityTabs />
        </div>
      )}

      {overlay === 'explorer' && <DeliveryExplorer />}
      {overlay === 'table' && <TableView />}
      {overlay === 'welcome' && <WelcomeModal />}
      <TourCoach />
      <HoverTooltip />
    </div>
  );
}
