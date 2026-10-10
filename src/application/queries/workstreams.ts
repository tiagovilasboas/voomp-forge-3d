import type { Contributor, ID, ISODate, Squad, StaffAssignment, StaffRole, WorkItem, Workstream, WorkstreamCategory } from '@domain/entities';
import { workstreamProgress, type LinkedChange, type WorkstreamProgress, type WorkstreamStatus } from '@domain/rules/workstreamProgress';
import { toDelivery, type Delivery } from './deliveries';
import type { ForgeIndex } from './forgeIndex';
import type { ScopeFilter } from './period';

export interface WorkstreamMember {
  assignment: StaffAssignment;
  /** Linked contributor; null for display-only names from the sheet. */
  person: Contributor | null;
}

export interface WorkstreamView {
  workstream: Workstream;
  progress: WorkstreamProgress;
  /** Issues of the front's epics (the epics themselves are not counted as work). */
  workItems: WorkItem[];
  /** Changes tied to the front by task key, or by initiative + repository. */
  changes: Delivery[];
  /** Squads involved: declared ones plus the squads of linked team members. */
  squads: Squad[];
  people: WorkstreamMember[];
}

export function workstreamWorkItems(idx: ForgeIndex, ws: Workstream): WorkItem[] {
  return ws.epicKeys.flatMap((k) => idx.workItemsByEpic.get(k) ?? []).filter((i) => i.type !== 'epic');
}

export function workstreamSquadIds(idx: ForgeIndex, ws: Workstream): ID[] {
  const ids = new Set(ws.squadIds);
  for (const t of ws.team) {
    const squadId = t.personId ? idx.person.get(t.personId)?.squadId : undefined;
    if (squadId) ids.add(squadId);
  }
  return [...ids];
}

function productionAtOf(idx: ForgeIndex, d: Delivery): ISODate | null {
  const dates = (idx.deploymentsByCr.get(d.cr.id) ?? [])
    .filter((x) => x.environment === 'production' && x.status === 'success')
    .map((x) => x.createdAt);
  return dates.reduce<ISODate | null>((best, x) => (!best || x > best ? x : best), null);
}

export function workstreamView(idx: ForgeIndex, ws: Workstream, scope: Pick<ScopeFilter, 'now'>): WorkstreamView {
  const items = workstreamWorkItems(idx, ws);
  const keys = new Set(items.map((i) => i.key));
  const repos = new Set(ws.repositoryIds);
  const changes = idx.snapshot.changeRequests
    .filter(
      (cr) =>
        cr.workItems.some((w) => keys.has(w.key)) ||
        (ws.initiativeId !== null && cr.initiativeId === ws.initiativeId && (repos.size === 0 || repos.has(cr.repositoryId))),
    )
    .map((cr) => toDelivery(idx, cr))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  const linked: LinkedChange[] = changes.map((d) => ({
    status: d.status,
    productionAt: d.status === 'in_production' ? productionAtOf(idx, d) : null,
  }));
  return {
    workstream: ws,
    progress: workstreamProgress({ workstream: ws, workItems: items, changes: linked, now: scope.now }),
    workItems: items,
    changes,
    squads: workstreamSquadIds(idx, ws)
      .map((id) => idx.squad.get(id))
      .filter((s): s is Squad => !!s),
    people: ws.team.map((assignment) => ({ assignment, person: assignment.personId ? (idx.person.get(assignment.personId) ?? null) : null })),
  };
}

export interface WorkstreamFilter {
  squadId?: ID | null;
  category?: WorkstreamCategory | null;
  status?: WorkstreamStatus | null;
}

const CATEGORY_ORDER: WorkstreamCategory[] = ['sprint_priority', 'closing', 'sustaining', 'open_topic'];
const RISK_ORDER: WorkstreamStatus[] = ['blocked', 'at_risk', 'in_progress', 'planned', 'on_demand', 'delivered'];

/** Fronts sorted by sheet category, then by risk (blocked first). The scope squad applies unless the filter sets one. */
export function listWorkstreams(idx: ForgeIndex, scope: ScopeFilter, f: WorkstreamFilter = {}): WorkstreamView[] {
  const squadId = f.squadId ?? scope.squadId;
  return idx.snapshot.workstreams
    .filter((ws) => !squadId || workstreamSquadIds(idx, ws).includes(squadId))
    .filter((ws) => !f.category || ws.category === f.category)
    .map((ws) => workstreamView(idx, ws, scope))
    .filter((v) => !f.status || v.progress.status === f.status)
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.workstream.category) - CATEGORY_ORDER.indexOf(b.workstream.category) ||
        RISK_ORDER.indexOf(a.progress.status) - RISK_ORDER.indexOf(b.progress.status) ||
        a.workstream.name.localeCompare(b.workstream.name),
    );
}

export interface AllocationRow {
  /** Contributor id, or `name:<display name>` for people without a record. */
  key: string;
  displayName: string;
  personId: ID | null;
  squadId: ID | null;
  assignments: { workstreamId: ID; role: StaffRole; specialty: string | null }[];
}

export interface AllocationMatrix {
  columns: { id: ID; name: string; category: WorkstreamCategory }[];
  rows: AllocationRow[];
}

/** Planning view: who is on which front, in which role. Deliberately carries no scores or metrics. */
export function allocationMatrix(idx: ForgeIndex): AllocationMatrix {
  const rows = new Map<string, AllocationRow>();
  for (const ws of idx.snapshot.workstreams) {
    for (const t of ws.team) {
      const key = t.personId ?? `name:${t.displayName}`;
      const row = rows.get(key) ?? {
        key,
        displayName: (t.personId && idx.person.get(t.personId)?.displayName) || t.displayName,
        personId: t.personId,
        squadId: (t.personId && idx.person.get(t.personId)?.squadId) || null,
        assignments: [],
      };
      row.assignments.push({ workstreamId: ws.id, role: t.role, specialty: t.specialty });
      rows.set(key, row);
    }
  }
  return {
    columns: idx.snapshot.workstreams.map((w) => ({ id: w.id, name: w.name, category: w.category })),
    rows: [...rows.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}

export interface RoadmapEntry {
  workstream: Workstream;
  status: WorkstreamStatus;
  plans: { label: string; target: ISODate | null; recordedAt: ISODate; current: boolean }[];
  deliveredAt: ISODate | null;
}

export function workstreamRoadmap(idx: ForgeIndex, scope: ScopeFilter): RoadmapEntry[] {
  return listWorkstreams(idx, scope).map((v) => ({
    workstream: v.workstream,
    status: v.progress.status,
    plans: v.workstream.plans.map((p, i, all) => ({ ...p, current: i === all.length - 1 })),
    deliveredAt: v.progress.deliveredAt,
  }));
}
