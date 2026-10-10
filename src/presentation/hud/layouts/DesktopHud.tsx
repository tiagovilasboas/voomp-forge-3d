import { useUiStore } from '../../state/uiStore';
import { isObjectRef } from '../objects/objectRefs';
import { ActivityTabs } from '../panels/ActivityTabs';
import { DeliveryTracking } from '../panels/DeliveryTracking';
import { Inspector } from '../panels/Inspector';
import { KpiStrip } from '../panels/KpiStrip';
import { LeftColumn } from '../panels/LeftColumn';
import { MapControls } from '../panels/MapControls';
import { TopBar } from '../panels/TopBar';
import { Legend } from '../views/Legend';

/**
 * Desktop (>= 1280px), the WareTrack-style arrangement:
 *
 *  ┌ TopBar ───────────────────────────────────────────────────────────┐
 *  │ KPI strip                                    [map ctl] Inspector  │
 *  │ Left column                                                       │
 *  │ (Product questions · Initiatives · View)          3D world        │
 *  │                                                                   │
 *  │ Delivery tracking            Legend              Activity tabs    │
 *  └───────────────────────────────────────────────────────────────────┘
 */
export function DesktopHud() {
  const hasSelection = useUiStore((s) => s.selection !== null && !isObjectRef(s.selection));
  return (
    <>
      <div className="absolute inset-x-3 top-3">
        <TopBar />
      </div>
      <div className="absolute top-[72px] left-3 max-w-[calc(100vw-400px)]">
        <KpiStrip />
      </div>
      <div className="absolute top-[156px] bottom-[206px] left-3 w-[272px]">
        <LeftColumn />
      </div>
      <div className={`absolute top-[72px] ${hasSelection ? 'right-[356px]' : 'right-3'}`}>
        <MapControls />
      </div>
      {hasSelection && (
        <div className="absolute top-[72px] right-3 w-[332px]">
          <Inspector />
        </div>
      )}
      <div className="absolute bottom-3 left-3 w-[min(560px,calc(100vw-360px))]">
        <DeliveryTracking />
      </div>
      <div className="pointer-events-none absolute right-[336px] bottom-3 left-[584px] flex justify-center [&>*]:pointer-events-auto">
        <Legend />
      </div>
      {!hasSelection && (
        <div className="absolute right-3 bottom-3 h-[290px] w-[312px]">
          <ActivityTabs />
        </div>
      )}
    </>
  );
}
