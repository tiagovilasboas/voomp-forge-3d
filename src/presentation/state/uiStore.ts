import { create } from 'zustand';
import type { ID } from '@domain/entities';
import type { PeriodDays } from '@application/queries/period';
import type { EntityRef } from '../world/worldModel';

export type ViewMode = 'product' | 'engineering';
export type Quality = 'high' | 'low';
export type Overlay = 'explorer' | 'table' | 'welcome' | null;

export type CameraCommand =
  | { type: 'focus'; ref: EntityRef; nonce: number }
  | { type: 'overview'; nonce: number }
  | { type: 'back'; nonce: number }
  | { type: 'zoom'; factor: number; nonce: number }
  | { type: 'rotate'; radians: number; nonce: number };

interface UiStore {
  periodDays: PeriodDays;
  squadId: ID | null;
  viewMode: ViewMode;
  selection: EntityRef | null;
  hover: EntityRef | null;
  /** Initiative whose racks and flows are highlighted in the scene. */
  highlightInitiativeId: ID | null;
  /** Change request shown in the Delivery tracking card. */
  trackedCrId: ID | null;
  overlay: Overlay;
  tourStep: number | null;
  reducedMotion: boolean;
  quality: Quality;
  camera: CameraCommand | null;

  setPeriod: (p: PeriodDays) => void;
  setSquad: (id: ID | null) => void;
  setViewMode: (m: ViewMode) => void;
  select: (ref: EntityRef | null, opts?: { focus?: boolean }) => void;
  setHover: (ref: EntityRef | null) => void;
  highlightInitiative: (id: ID | null) => void;
  track: (crId: ID | null) => void;
  openOverlay: (o: Overlay) => void;
  setTourStep: (step: number | null) => void;
  setReducedMotion: (v: boolean) => void;
  setQuality: (q: Quality) => void;
  commandCamera: (cmd: DistributiveOmit<CameraCommand, 'nonce'>) => void;
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const isSmallScreen = () => typeof window !== 'undefined' && window.innerWidth < 760;

let nonce = 0;

/** Interaction + presentation state. Never holds domain data. */
export const useUiStore = create<UiStore>((set, get) => ({
  periodDays: 14,
  squadId: null,
  viewMode: 'product',
  selection: null,
  hover: null,
  highlightInitiativeId: null,
  trackedCrId: null,
  overlay: null,
  tourStep: null,
  reducedMotion: prefersReducedMotion(),
  quality: isSmallScreen() ? 'low' : 'high',
  camera: null,

  setPeriod: (periodDays) => set({ periodDays }),
  setSquad: (squadId) => {
    set({ squadId });
    get().commandCamera(squadId ? { type: 'focus', ref: { kind: 'squad', id: squadId } } : { type: 'overview' });
  },
  setViewMode: (viewMode) => set({ viewMode }),
  select: (selection, opts = { focus: true }) => {
    const prev = get().selection;
    set({
      selection,
      trackedCrId: selection?.kind === 'cr' ? selection.id : get().trackedCrId,
      highlightInitiativeId: selection?.kind === 'initiative' ? selection.id : get().highlightInitiativeId,
    });
    if (selection && opts.focus) get().commandCamera({ type: 'focus', ref: selection });
    if (!selection && prev) get().commandCamera({ type: 'back' });
  },
  setHover: (hover) => set({ hover }),
  highlightInitiative: (highlightInitiativeId) => set({ highlightInitiativeId }),
  track: (trackedCrId) => set({ trackedCrId }),
  openOverlay: (overlay) => set({ overlay }),
  setTourStep: (tourStep) => set({ tourStep }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setQuality: (quality) => set({ quality }),
  commandCamera: (cmd) => set({ camera: { ...cmd, nonce: ++nonce } as CameraCommand }),
}));
