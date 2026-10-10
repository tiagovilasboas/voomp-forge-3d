import { useMemo } from 'react';
import { useDataStore, useReadyData } from '@presentation/state/dataStore';
import { Chip, Segmented } from '@presentation/hud/kit/primitives';
import { relativeTime } from '@presentation/hud/kit/format';

/** Source pill: DEMO DATA flag, snapshot freshness and the data source switch. */
export function SourceStatus() {
  const { snapshot } = useReadyData();
  const sources = useDataStore((s) => s.sources);
  const load = useDataStore((s) => s.load);
  const isDemo = snapshot.source.kind === 'demo';
  const syncedAgo = useMemo(() => relativeTime(snapshot.source.generatedAt, new Date()), [snapshot]);

  const options = sources.map((source) => {
    const availability = source.availability();
    return { value: source.kind, label: source.label, disabled: !availability.available, title: availability.reason };
  });

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isDemo && <Chip tone="demo">DEMO DATA</Chip>}
      <span className="hidden text-[11px] whitespace-nowrap text-fog 2xl:inline">Snapshot · sincronizado {syncedAgo}</span>
      {options.length > 1 && (
        <div className="hidden 2xl:block">
          <Segmented
            label="Fonte de dados"
            value={snapshot.source.kind}
            onChange={(kind) => {
              const source = sources.find((s) => s.kind === kind);
              if (source) void load(source);
            }}
            options={options}
          />
        </div>
      )}
    </div>
  );
}
