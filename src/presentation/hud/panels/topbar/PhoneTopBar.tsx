import { useReadyData } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';
import { Chip, IconButton } from '../../kit/primitives';
import { ForgeMark } from './ForgeLogo';
import { SquadSelect } from './SquadSelect';

/** Phone top bar (56px): mark, squad code, DEMO chip, search and the overflow ("Mais") menu. */
export function PhoneTopBar() {
  const { snapshot } = useReadyData();
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setTab = useUiStore((s) => s.setMobileTab);
  const tab = useUiStore((s) => s.mobileTab);

  return (
    <header aria-label="Barra superior" className="hud-card relative z-30 flex h-14 items-center gap-2 px-2">
      <span className="shrink-0 pl-1" role="img" aria-label="Voomp Forge">
        <ForgeMark />
      </span>
      <SquadSelect />
      {snapshot.source.kind === 'demo' && (
        <span className="shrink-0">
          <Chip tone="demo">DEMO DATA</Chip>
        </span>
      )}
      <div className="ml-auto flex shrink-0 items-center">
        <IconButton icon="search" label="Buscar" onClick={() => setSearchOpen(true)} />
        <IconButton icon="gear" label="Mais opções" active={tab === 'more'} onClick={() => setTab(tab === 'more' ? 'map' : 'more')} />
      </div>
    </header>
  );
}
