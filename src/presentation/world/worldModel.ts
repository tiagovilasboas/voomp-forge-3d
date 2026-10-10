import type { ContributorRole, ID } from '@domain/entities';
import type { SectorTheme } from '@config/world';
import type { Facing } from './frame';

/** 2D point on the floor plane (x, z). Height is decided by each renderer. */
export type Vec2 = readonly [number, number];

export type EntityRef =
  | { kind: 'squad'; id: ID }
  | { kind: 'repo'; id: ID }
  | { kind: 'person'; id: ID }
  | { kind: 'cr'; id: ID }
  | { kind: 'initiative'; id: ID }
  | { kind: 'document'; id: ID }
  | { kind: 'whiteboard' }
  /** Sector wall board. id = `${squadId}:changes` | `${squadId}:deliveries`. */
  | { kind: 'board'; id: string }
  /** A person's workstation (holographic desk monitor). id = personId. */
  | { kind: 'desk'; id: ID }
  /** Hub IA objects. */
  | { kind: 'hub' }
  | { kind: 'terminal' }
  | { kind: 'pinball' }
  /** n8n workstation in the Hub IA (future ingestion automation). */
  | { kind: 'automation' }
  /** Delivery fronts wall ("Mural de Frentes") and delivery calendar wall. */
  | { kind: 'fronts' }
  | { kind: 'calendar' }
  /** A single delivery front. id = workstream id. */
  | { kind: 'workstream'; id: ID }
  | { kind: 'gate' };

export const refKey = (r: EntityRef) => ('id' in r ? `${r.kind}:${r.id}` : r.kind);

export interface SectorLayout {
  squadId: ID;
  code: string;
  name: string;
  theme: SectorTheme;
  center: Vec2;
  size: Vec2;
  /** 1 = front toward +z (north row); -1 = rotated 180° (south row). All points below are world coordinates. */
  facing: Facing;
  /** World z of the walkway inside the room, parallel to its front. */
  aisleZ: number;
  /** World x where people leave the room toward the corridor. */
  exitX: number;
  /** World z of this row's scooter lane in the corridor. */
  laneZ: number;
  boards: { changes: Vec2; deliveries: Vec2 };
  feature: Vec2;
}

export interface RackLayout {
  repoId: ID;
  squadId: ID;
  facing: Facing;
  position: Vec2;
  /** Where a figure stands to work on this rack. */
  servicePoint: Vec2;
}

export interface FigureLayout {
  personId: ID;
  squadId: ID;
  facing: Facing;
  role: ContributorRole | null;
  desk: Vec2;
  /** Seat point in front of the desk. */
  home: Vec2;
}

export interface WorldModel {
  sectors: SectorLayout[];
  racks: RackLayout[];
  figures: FigureLayout[];
  corridorZ: number;
  gate: Vec2;
  stagingDock: Vec2;
  /** "Entregue esta semana" whiteboard next to the gate. */
  weekBoard: Vec2;
  creditPlaque: Vec2;
  /** "Mural de Frentes" and the delivery calendar, by the corridor near the gate. */
  frontsWall: Vec2;
  calendarWall: Vec2;
  /** Hub IA room: knowledge base, terminal and holographic pinball. */
  aiHub: { center: Vec2; size: Vec2; facing: Facing; terminal: Vec2; pinball: Vec2; automation: Vec2 };
  /** Knowledge base vault (Confluence, Notion, docs in repos…), inside the Hub IA. */
  knowledgeVault: Vec2;
  bounds: { min: Vec2; max: Vec2 };
}

/** Focus targets for the camera: centre + radius on the floor. */
export interface FocusTarget {
  center: Vec2;
  radius: number;
}
