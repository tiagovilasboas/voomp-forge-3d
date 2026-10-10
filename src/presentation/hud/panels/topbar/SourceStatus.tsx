import { useMemo } from 'react';
import { useReadyData } from '@presentation/state/dataStore';
import { Chip, Segmented } from '@presentation/hud/kit/primitives';
import { relativeTime } from '@presentation/hud/kit/format';

/**
 * Connected mode needs the Forge backend. Presentation must not import infrastructure,
 * so the reason mirrors RemoteDataSource.availability().
 */
const CONNECTED_UNAVAILABLE = 'Requer o backend Voomp Forge com autenticação e conector Git. Ainda não disponível.';

/** Source pill: DEMO DATA flag, snapshot freshness and the (disabled) connected switch. */
export function SourceStatus() {
  const { snapshot } = useReadyData();
  const isDemo = snapshot.source.kind === 'demo';
  const syncedAgo = useMemo(() => relativeTime(snapshot.source.generatedAt, new Date()), [snapshot]);

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isDemo && <Chip tone="demo">DEMO DATA</Chip>}
      <span className="hidden text-[11px] whitespace-nowrap text-fog 2xl:inline">Snapshot · sincronizado {syncedAgo}</span>
      <div className="hidden 2xl:block">
        <Segmented
          label="Fonte de dados"
          value={snapshot.source.kind === 'demo' ? 'demo' : 'connected'}
          onChange={() => undefined}
          options={[
            { value: 'demo', label: 'Demo Mode' },
            { value: 'connected', label: 'Conectado', disabled: true, title: CONNECTED_UNAVAILABLE },
          ]}
        />
      </div>
    </div>
  );
}
