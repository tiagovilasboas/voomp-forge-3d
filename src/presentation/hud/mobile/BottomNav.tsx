import type { ReactNode } from 'react';
import { useUiStore, type MobileTab } from '@presentation/state/uiStore';
import type { IconName } from '@presentation/theme';
import { Icon } from '../kit/Icon';

function MoreIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

const ITEMS: { id: MobileTab; label: string; icon: IconName | null }[] = [
  { id: 'map', label: 'Mapa', icon: 'compass' },
  { id: 'questions', label: 'Perguntas', icon: 'help' },
  { id: 'deliveries', label: 'Entregas', icon: 'rocket' },
  { id: 'initiatives', label: 'Iniciativas', icon: 'target' },
  { id: 'more', label: 'Mais', icon: null },
];

/**
 * Phone bottom navigation. "Mapa" closes any sheet; tapping it again clears the selection
 * or, with nothing selected, returns the camera to the overview.
 */
export function BottomNav() {
  const tab = useUiStore((s) => s.mobileTab);
  const setTab = useUiStore((s) => s.setMobileTab);

  const onPick = (id: MobileTab) => {
    const ui = useUiStore.getState();
    if (id === 'map' && ui.mobileTab === 'map') {
      if (ui.selection) ui.select(null);
      else ui.commandCamera({ type: 'overview' });
    }
    setTab(id === tab && id !== 'map' ? 'map' : id);
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="absolute inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      style={{ height: 'var(--mobile-nav-h)' }}
    >
      {ITEMS.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onPick(item.id)}
            className={`focus-ring flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
              active ? 'text-forge-bright' : 'text-fog active:text-snow'
            }`}
          >
            <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? 'bg-forge/15' : ''}`}>
              {item.icon ? <Icon name={item.icon} size={20} /> : <MoreIcon />}
            </span>
            {item.label as ReactNode}
          </button>
        );
      })}
    </nav>
  );
}
