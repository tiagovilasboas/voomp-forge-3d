import { useUiStore } from '../../state/uiStore';
import { Drawer } from '../kit/Drawer';
import { useMediaQuery } from '../kit/useMediaQuery';
import { DeliveryTracking } from '../panels/DeliveryTracking';
import { Inspector } from '../panels/Inspector';
import { KpiStrip } from '../panels/KpiStrip';
import { LeftColumn } from '../panels/LeftColumn';
import { MapControls } from '../panels/MapControls';
import { TopBar } from '../panels/TopBar';

const DRAWER_W = 300;
const INSPECTOR_W = 320;
const GUTTER = 12;

/**
 * Tablet (768-1279px): top bar + KPI strip, left column in a drawer (docked in landscape,
 * overlay in portrait), inspector as a 320px side panel, tracking card at the bottom.
 * Activity queues sit behind the top-bar button.
 */
export function TabletHud() {
  const hasSelection = useUiStore((s) => s.selection !== null);
  const drawerOpen = useUiStore((s) => s.leftDrawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setLeftDrawerOpen);
  const docked = useMediaQuery('(min-width: 1024px)');

  const left = docked && drawerOpen ? GUTTER * 2 + DRAWER_W : GUTTER;
  const right = hasSelection ? GUTTER * 2 + INSPECTOR_W : GUTTER;

  return (
    <>
      <div className="absolute inset-x-3 top-3 z-30">
        <TopBar />
      </div>
      <div className="absolute top-[72px] left-3 max-w-[calc(100vw-24px)]">
        <KpiStrip />
      </div>
      <Drawer
        open={drawerOpen}
        label="Painel lateral"
        overlay={!docked}
        onClose={() => setDrawerOpen(false)}
        className="absolute top-[156px] bottom-3 left-3 w-[300px]"
      >
        <LeftColumn />
      </Drawer>
      <div className="absolute top-[156px]" style={{ right }}>
        <MapControls />
      </div>
      {hasSelection && (
        <div className="absolute top-[156px] right-3 w-[320px]">
          <Inspector />
        </div>
      )}
      <div className="absolute bottom-3" style={{ left, width: `min(560px, calc(100vw - ${left + right}px))` }}>
        <DeliveryTracking />
      </div>
    </>
  );
}
