import { useUiStore } from '../state/uiStore';
import { HoverTooltip } from './panels/HoverTooltip';
import { useBreakpoint } from './kit/useMediaQuery';
import { DesktopHud } from './layouts/DesktopHud';
import { PhoneHud } from './layouts/PhoneHud';
import { TabletHud } from './layouts/TabletHud';
import { ObjectScreenHost } from './objects/ObjectScreenHost';
import { DeliveryExplorer } from './views/DeliveryExplorer';
import { TableView } from './views/TableView';
import { TourCoach, WelcomeModal } from './views/WelcomeModal';

/**
 * Picks the arrangement for the viewport tier (docs/RESPONSIVE_SPEC.md) and mounts the overlays
 * shared by all of them. The layer ignores pointer events; only cards capture them, so the world
 * stays explorable between panels.
 */
export function HudLayout() {
  const overlay = useUiStore((s) => s.overlay);
  const breakpoint = useBreakpoint();
  const Layout = breakpoint === 'phone' ? PhoneHud : breakpoint === 'tablet' ? TabletHud : DesktopHud;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto">
      <Layout />
      {overlay === 'explorer' && <DeliveryExplorer />}
      {overlay === 'table' && <TableView />}
      {overlay === 'welcome' && <WelcomeModal />}
      <ObjectScreenHost />
      <TourCoach />
      <HoverTooltip />
    </div>
  );
}
