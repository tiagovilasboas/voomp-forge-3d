import { useUiStore } from '../../state/uiStore';
import { KpiStrip } from '../panels/KpiStrip';
import { MapControls } from '../panels/MapControls';
import { TopBar } from '../panels/TopBar';
import { BottomNav } from '../mobile/BottomNav';
import { MobileSheets } from '../mobile/MobileSheets';
import { SearchSheet } from '../mobile/SearchSheet';

/**
 * Phone (< 768px): the world stays full-bleed. Compact top bar, KPI carousel, floating map
 * controls, bottom navigation and bottom sheets (tabs or the inspector).
 */
export function PhoneHud() {
  const searchOpen = useUiStore((s) => s.searchOpen);
  const sheetFull = useUiStore((s) => s.sheetFull);
  const sheetOpen = useUiStore((s) => s.mobileTab !== 'map' || s.selection !== null);
  return (
    <>
      <div className="absolute inset-x-2 top-[calc(8px+env(safe-area-inset-top))] z-30">
        <TopBar />
      </div>
      <div className="absolute inset-x-0 top-[calc(72px+env(safe-area-inset-top))]">
        <KpiStrip />
      </div>
      {!sheetFull && (
        <div className="absolute right-2 z-20" style={{ bottom: `calc(var(--mobile-nav-h) + ${sheetOpen ? '35dvh + ' : ''}8px)` }}>
          <MapControls compact />
        </div>
      )}
      <MobileSheets />
      <BottomNav />
      {searchOpen && <SearchSheet />}
    </>
  );
}
