/**
 * Declarative world configuration. Squads and repositories come from data;
 * this file only decides how a sector *looks* and the layout rhythm.
 * A squad without an explicit theme gets the next theme in `THEME_CYCLE`.
 */

export type SectorFeature = 'coordination-desk' | 'monitoring-room' | 'architecture-room';

export interface SectorTheme {
  feature: SectorFeature;
  /** Accent used on floor trims and signage (stays within the brand palette). */
  accent: string;
  /** Short subtitle painted on the floor. */
  tagline: string;
}

export const SECTOR_THEMES: Record<string, SectorTheme> = {
  'sq-admin': { feature: 'coordination-desk', accent: '#FF6A00', tagline: 'Features & interfaces administrativas' },
  'sq-n3': { feature: 'monitoring-room', accent: '#FF8C32', tagline: 'Operação, incidentes e correções' },
  'sq-enable': { feature: 'architecture-room', accent: '#F6B94D', tagline: 'Plataforma, ferramentas e habilitação' },
};

export const THEME_CYCLE: SectorTheme[] = Object.values(SECTOR_THEMES);

export const LAYOUT = {
  sectorDepth: 15,
  sectorMinWidth: 17,
  sectorGap: 4.5,
  rackSpacing: 2.8,
  deskSpacing: 2.6,
  /** Centre line (z) of the shared central corridor; rooms sit in two rows facing each other across it. */
  corridorZ: 0,
  /** Corridor width: room front edge to room front edge. */
  corridorWidth: 8,
  /** Distance from the corridor centre line to a row's scooter lane. */
  laneOffset: 2.6,
  /** Hub IA footprint width. */
  hubWidth: 16,
  /** Empty margin around the rooms, inside the world bounds. */
  margin: 3,
} as const;

export function themeFor(squadId: string, order: number): SectorTheme {
  return SECTOR_THEMES[squadId] ?? THEME_CYCLE[order % THEME_CYCLE.length];
}
