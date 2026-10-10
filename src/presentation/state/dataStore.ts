import { create } from 'zustand';
import type { ForgeSnapshot } from '@domain/entities';
import type { DeliveryDataSource } from '@application/ports/DeliveryDataSource';
import { buildIndex, type ForgeIndex } from '@application/queries/forgeIndex';
import { buildWorld } from '../world/buildWorld';
import type { WorldModel } from '../world/worldModel';

type DataState =
  | { status: 'idle' | 'loading'; snapshot: null; index: null; world: null; error: null }
  | { status: 'ready'; snapshot: ForgeSnapshot; index: ForgeIndex; world: WorldModel; error: null }
  | { status: 'error'; snapshot: null; index: null; world: null; error: string };

interface DataStore {
  state: DataState;
  source: DeliveryDataSource | null;
  load: (source: DeliveryDataSource) => Promise<void>;
}

const EMPTY = { snapshot: null, index: null, world: null, error: null } as const;

/** Owns the loaded snapshot and everything derived once per snapshot (index, world layout). */
export const useDataStore = create<DataStore>((set) => ({
  state: { status: 'idle', ...EMPTY },
  source: null,
  async load(source) {
    const availability = source.availability();
    if (!availability.available) {
      set({ source, state: { status: 'error', snapshot: null, index: null, world: null, error: availability.reason ?? 'Fonte indisponível.' } });
      return;
    }
    set({ source, state: { status: 'loading', ...EMPTY } });
    try {
      const snapshot = await source.load();
      const index = buildIndex(snapshot);
      const world = buildWorld(snapshot.squads, snapshot.repositories, snapshot.contributors);
      set({ state: { status: 'ready', snapshot, index, world, error: null } });
    } catch (e) {
      set({ state: { status: 'error', snapshot: null, index: null, world: null, error: e instanceof Error ? e.message : String(e) } });
    }
  },
}));

/** Use inside components rendered only when data is ready. */
export function useReadyData() {
  const state = useDataStore((s) => s.state);
  if (state.status !== 'ready') throw new Error('useReadyData called before data is ready');
  return state;
}
