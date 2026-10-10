import type { ISODate, WorkItem, Workstream } from '@domain/entities';
import type { DeliveryStatus } from './changeRequestProgress';

/**
 * Evidence rules for a front (frente). The planning sheet says what was planned
 * and what the team *declares*; only the tracker (Jira…) and Git say what
 * actually happened. A front is "delivered" only with production evidence from
 * Jira or Git and no contradiction between them.
 */

export interface LinkedChange {
  status: DeliveryStatus;
  /** When production was confirmed for this change, if it was. */
  productionAt: ISODate | null;
}

export interface WorkstreamEvidence {
  workstream: Workstream;
  workItems: WorkItem[];
  changes: LinkedChange[];
  now: Date;
}

export type WorkstreamStatus =
  | 'delivered' // production evidence for the linked work
  | 'blocked' // declared blocker or a linked change blocked (CI / changes requested)
  | 'at_risk' // committed date passed without delivery
  | 'in_progress' // there is movement (items or changes)
  | 'planned' // nothing started yet
  | 'on_demand'; // sustaining work without a committed date

export type EvidenceSource = 'tracker' | 'git';

export interface WorkstreamProgress {
  status: WorkstreamStatus;
  /** Where production evidence came from. Empty = none. */
  evidence: EvidenceSource[];
  /** Tracker and Git disagree (e.g. Jira says in production, linked change not deployed). */
  divergence: boolean;
  items: { done: number; total: number };
  changes: { open: number; merged: number; production: number; blocked: number };
  /** Current committed target, if any. */
  target: ISODate | null;
  /** Times the plan changed after the first one. */
  replans: number;
  /** The sheet says "done" but there is no production evidence. */
  declaredWithoutEvidence: boolean;
  /** Last production confirmation among linked changes. */
  deliveredAt: ISODate | null;
  /** Delivered on or before the current target (null when not applicable). */
  onTime: boolean | null;
  waitingOn: string[];
  blockers: string[];
}

const BLOCKED: DeliveryStatus[] = ['ci_failed', 'changes_requested'];
const MERGED: DeliveryStatus[] = ['merged', 'in_staging', 'in_production'];

function latest(dates: (ISODate | null)[]): ISODate | null {
  return dates.reduce<ISODate | null>((best, d) => (d && (!best || d > best) ? d : best), null);
}

export function workstreamProgress(e: WorkstreamEvidence): WorkstreamProgress {
  const ws = e.workstream;
  const current = ws.plans[ws.plans.length - 1] ?? null;
  const target = current?.target ?? null;
  const distinctTargets = new Set(ws.plans.map((p) => p.target ?? p.label));
  const replans = Math.max(0, distinctTargets.size - 1);

  const itemsDone = e.workItems.filter((i) => i.status === 'done').length;
  const production = e.changes.filter((c) => c.status === 'in_production');
  const merged = e.changes.filter((c) => MERGED.includes(c.status));
  const open = e.changes.filter((c) => !MERGED.includes(c.status) && c.status !== 'closed');
  const blockedChanges = e.changes.filter((c) => BLOCKED.includes(c.status));

  const blockers = ws.dependencies.filter((d) => d.kind === 'blocker').map((d) => d.description);
  const waitingOn = ws.dependencies.filter((d) => d.kind === 'waiting').map((d) => d.description);

  // Production evidence comes from the tracker or from Git — never from the sheet.
  const itemsInProduction = e.workItems.filter((i) => i.productionAt);
  const evidence: EvidenceSource[] = [
    ...(itemsInProduction.length ? (['tracker'] as const) : []),
    ...(production.length ? (['git'] as const) : []),
  ];
  // Git agrees when every linked change that was merged reached production and nothing is open.
  const gitAgrees = e.changes.length === 0 || (open.length === 0 && merged.length === production.length);
  // The tracker agrees when every issue is done.
  const trackerAgrees = e.workItems.length === 0 || itemsDone === e.workItems.length;
  const divergence =
    (itemsInProduction.length > 0 && e.changes.some((c) => MERGED.includes(c.status) && c.status !== 'in_production')) ||
    (production.length > 0 && e.workItems.some((i) => i.status !== 'done'));
  const delivered = evidence.length > 0 && gitAgrees && trackerAgrees && !divergence;

  const deliveredAt = delivered ? latest([...production.map((c) => c.productionAt), ...itemsInProduction.map((i) => i.productionAt)]) : null;
  const overdue = !delivered && target !== null && e.now.toISOString() > target;
  const moving = itemsDone > 0 || e.workItems.some((i) => i.status === 'in_progress') || e.changes.length > 0;

  let status: WorkstreamStatus;
  if (delivered) status = 'delivered';
  else if (blockers.length || blockedChanges.length) status = 'blocked';
  else if (overdue) status = 'at_risk';
  else if (!target && ws.category === 'sustaining') status = 'on_demand';
  else if (moving) status = 'in_progress';
  else status = 'planned';

  return {
    status,
    evidence,
    divergence,
    items: { done: itemsDone, total: e.workItems.length },
    changes: { open: open.length, merged: merged.length, production: production.length, blocked: blockedChanges.length },
    target,
    replans,
    declaredWithoutEvidence: ws.declaredDone && !delivered,
    deliveredAt,
    onTime: delivered && target && deliveredAt ? deliveredAt.slice(0, 10) <= target.slice(0, 10) : null,
    waitingOn,
    blockers,
  };
}
