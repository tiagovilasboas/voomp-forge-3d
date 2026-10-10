import { useEffect } from 'react';
import { useUiStore, type MobileTab } from '@presentation/state/uiStore';
import { BottomSheet, type Snap } from '../kit/BottomSheet';
import { ActivityTabs } from '../panels/ActivityTabs';
import { DeliveryTracking } from '../panels/DeliveryTracking';
import { InspectorContent } from '../panels/Inspector';
import { InitiativesCard } from '../panels/left/InitiativesCard';
import { TechHealth } from '../panels/left/TechHealth';
import { WeeklyQuestions } from '../panels/left/WeeklyQuestions';
import { MoreContent } from './MoreContent';

const TITLES: Record<Exclude<MobileTab, 'map'>, string> = {
  questions: 'Perguntas',
  deliveries: 'Entregas',
  initiatives: 'Iniciativas',
  more: 'Mais',
};

function TabContent({ tab }: { tab: Exclude<MobileTab, 'map'> }) {
  const viewMode = useUiStore((s) => s.viewMode);
  switch (tab) {
    case 'questions':
      return <div className="p-3">{viewMode === 'product' ? <WeeklyQuestions /> : <TechHealth />}</div>;
    case 'deliveries':
      return (
        <div className="space-y-3 p-3">
          <div className="h-[min(420px,56dvh)]">
            <ActivityTabs />
          </div>
          <DeliveryTracking />
        </div>
      );
    case 'initiatives':
      return (
        <div className="p-3">
          <InitiativesCard />
        </div>
      );
    case 'more':
      return <MoreContent />;
  }
}

/**
 * The phone's sheets: the tab sheet chosen in the bottom navigation, or, when something is
 * selected and no tab is open, the inspector at `peek`.
 */
export function MobileSheets() {
  const tab = useUiStore((s) => s.mobileTab);
  const hasSelection = useUiStore((s) => s.selection !== null);
  const setTab = useUiStore((s) => s.setMobileTab);
  const select = useUiStore((s) => s.select);
  const setSheetFull = useUiStore((s) => s.setSheetFull);
  const onSnap = (snap: Snap) => setSheetFull(snap === 'full');

  // A new selection (from the map, search or a list) takes over from any open tab sheet.
  const selectionKey = useUiStore((s) => (s.selection ? JSON.stringify(s.selection) : ''));
  useEffect(() => {
    if (selectionKey) useUiStore.getState().setMobileTab('map');
  }, [selectionKey]);

  if (tab !== 'map') {
    return (
      <BottomSheet key={tab} label={TITLES[tab]} showTitle initialSnap="full" onClose={() => setTab('map')} onSnapChange={onSnap}>
        <TabContent tab={tab} />
      </BottomSheet>
    );
  }
  if (hasSelection) {
    return (
      <BottomSheet label="Detalhes" onClose={() => select(null)} onSnapChange={onSnap}>
        <InspectorContent />
      </BottomSheet>
    );
  }
  return null;
}

