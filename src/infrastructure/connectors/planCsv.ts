import type { Connector, ConnectorContext, SnapshotFragment } from '@application/ports/connectors';
import type {
  PlannedDelivery,
  StaffAssignment,
  StaffRole,
  Workstream,
  WorkstreamCategory,
  WorkstreamDependency,
} from '@domain/entities';
import { slug } from '../git/buildSnapshotFromGit';

/**
 * Planning sheet exported as CSV in MATRIX layout: a header row of front names, then rows whose first
 * cell is a role (TL, DEV, QA, PM, N2) or "Entrega" / "Obs". Title rows ("FECHAMENTOS"…) set the category.
 * Nothing here is production evidence: the sheet only declares plans.
 */

export interface FrontMapping {
  epicKeys?: string[];
  links?: { label: string; url: string }[];
  initiativeId?: string | null;
  squadIds?: string[];
  repositoryIds?: string[];
}

export interface PlanCsvOptions {
  snapshotDate: Date;
  /** Monday-ish start of "Semana 1". Without it, "Semana N" alone yields no date. */
  sprintStart?: Date;
  /** Fronts parsed from earlier exports (oldest first chain result), used for plan history. */
  previous?: Workstream[];
  /** Optional per-front mapping, keyed by front name or id. */
  fronts?: Record<string, FrontMapping>;
  /** Display name → contributor id. Keys are normalised (case/accents) names. */
  people?: Record<string, string>;
}

// --- CSV --------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(src);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function detectDelimiter(src: string): string {
  const firstLines = src.split(/\r?\n/).slice(0, 10).join('\n');
  return (firstLines.match(/;/g)?.length ?? 0) > (firstLines.match(/,/g)?.length ?? 0) ? ';' : ',';
}

// --- helpers ----------------------------------------------------------------

export const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const clean = (s: string | undefined) => (s ?? '').trim();
const isEmpty = (s: string | undefined) => ['', '-', '–', '—', 'n/a'].includes(clean(s).toLowerCase());

const ROLE_LABELS: Record<string, StaffRole | 'entrega' | 'obs'> = {
  tl: 'tl', dev: 'dev', qa: 'qa', pm: 'pm', n2: 'n2', entrega: 'entrega', obs: 'obs', observacao: 'obs', observacoes: 'obs',
};

function categoryFromTitle(text: string): WorkstreamCategory | null {
  const t = normName(text);
  if (t.includes('fechament')) return 'closing';
  if (t.includes('priorid')) return 'sprint_priority';
  if (t.includes('aberto')) return 'open_topic';
  if (t.includes('sustent')) return 'sustaining';
  return null;
}

export function parsePeople(cell: string, role: StaffRole): StaffAssignment[] {
  if (isEmpty(cell)) return [];
  return cell
    .split(/[\/,;\n]/)
    .map((part) => part.trim())
    .filter((part) => !isEmpty(part))
    .map((part) => {
      let name = part;
      let specialty: string | null = null;
      const paren = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(part);
      const dash = /^(.*?)\s+[-–—]\s+(.+)$/.exec(part);
      const m = paren ?? dash;
      if (m) { name = m[1].trim(); specialty = normName(m[2]) || null; }
      return { role, personId: null, displayName: name, specialty };
    })
    .filter((a) => a.displayName !== '');
}

const WEEKDAYS: Record<string, number> = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4 };
const DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Parses "Semana 2 - quinta (10)", "dd/mm", "(dd)". Returns null when no committed date can be derived. */
export function parsePlanTarget(label: string, snapshotDate: Date, sprintStart?: Date): string | null {
  const text = normName(label);
  const dm = /\b(\d{1,2})\/(\d{1,2})\b/.exec(text);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return utc(snapshotDate.getUTCFullYear(), month - 1, day).toISOString();
  }
  const pd = /\((\d{1,2})\)/.exec(text);
  if (pd) {
    const day = Number(pd[1]);
    if (day >= 1 && day <= 31) {
      const base = sprintStart ?? snapshotDate;
      let date = utc(base.getUTCFullYear(), base.getUTCMonth(), day);
      if (sprintStart && date.getTime() < utc(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()).getTime()) {
        date = utc(base.getUTCFullYear(), base.getUTCMonth() + 1, day);
      }
      return date.toISOString();
    }
  }
  const wk = /semana\s*(\d+)/.exec(text);
  if (wk && sprintStart) {
    const n = Number(wk[1]);
    const dow = (sprintStart.getUTCDay() + 6) % 7; // Monday = 0
    const monday = utc(sprintStart.getUTCFullYear(), sprintStart.getUTCMonth(), sprintStart.getUTCDate()).getTime() - dow * DAY;
    const dayWord = Object.keys(WEEKDAYS).find((d) => text.includes(d));
    return new Date(monday + (n - 1) * 7 * DAY + (dayWord ? WEEKDAYS[dayWord] : 4) * DAY).toISOString();
  }
  return null;
}

function classifyNote(text: string): WorkstreamDependency | null {
  const t = normName(text);
  if (/depend|bloque/.test(t)) return { description: text, kind: 'blocker' };
  if (/aguard|retorno/.test(t)) return { description: text, kind: 'waiting' };
  return null;
}

// --- parser -----------------------------------------------------------------

interface Block {
  category: WorkstreamCategory;
  header: string[];
  rows: { kind: StaffRole | 'entrega' | 'obs'; cells: string[] }[];
}

export function parsePlanCsv(text: string, options: PlanCsvOptions): Workstream[] {
  const rows = parseCsv(text);
  const blocks: Block[] = [];
  let category: WorkstreamCategory = 'sprint_priority';
  let current: Block | null = null;

  for (const row of rows) {
    const nonEmpty = row.map((c, i) => ({ c: clean(c), i })).filter((x) => !isEmpty(x.c));
    if (nonEmpty.length === 0) continue;
    const role = ROLE_LABELS[normName(clean(row[0]))];
    if (role) {
      if (current) current.rows.push({ kind: role, cells: row.map(clean) });
      continue;
    }
    const titleCats = nonEmpty.map((x) => categoryFromTitle(x.c));
    if (titleCats.every((c) => c !== null) || (nonEmpty.length === 1 && nonEmpty[0].i === 0)) {
      category = titleCats[0] ?? 'sprint_priority';
      current = null;
      continue;
    }
    current = { category, header: row.map(clean), rows: [] };
    blocks.push(current);
  }

  const previousById = new Map((options.previous ?? []).map((w) => [w.id, w]));
  const recordedAt = options.snapshotDate.toISOString();
  const result = new Map<string, Workstream>();

  for (const block of blocks) {
    block.header.forEach((name, col) => {
      if (col === 0 || isEmpty(name)) return;
      const id = slug(normName(name));
      const team: StaffAssignment[] = [];
      let entrega = '';
      const dependencies: WorkstreamDependency[] = [];
      const notes: string[] = [];
      for (const r of block.rows) {
        const cell = clean(r.cells[col]);
        if (isEmpty(cell)) continue;
        if (r.kind === 'entrega') entrega = cell;
        else if (r.kind === 'obs') {
          const dep = classifyNote(cell);
          if (dep) dependencies.push(dep);
          else notes.push(cell);
        } else {
          for (const p of parsePeople(cell, r.kind)) {
            team.push({ ...p, personId: options.people?.[normName(p.displayName)] ?? null });
          }
        }
      }

      const prev = previousById.get(id);
      const plans: PlannedDelivery[] = [...(prev?.plans ?? [])];
      if (entrega !== '') {
        const target = parsePlanTarget(entrega, options.snapshotDate, options.sprintStart);
        const last = plans[plans.length - 1];
        if (!last || last.label !== entrega || last.target !== target) plans.push({ label: entrega, target, recordedAt });
      }

      const map = options.fronts?.[name] ?? options.fronts?.[id] ?? {};
      result.set(id, {
        id,
        name,
        category: block.category,
        squadIds: map.squadIds ?? [],
        initiativeId: map.initiativeId ?? null,
        repositoryIds: map.repositoryIds ?? [],
        epicKeys: map.epicKeys ?? [],
        team,
        plans,
        dependencies,
        declaredDone: /finalizad|entregue/.test(normName(entrega)),
        links: map.links ?? [],
        notes,
      });
    });
  }
  return [...result.values()];
}

// --- connector --------------------------------------------------------------

export interface PlanCsvConfig {
  path: string;
  /** Earlier exports, oldest first, to detect replans. */
  previous?: (string | { path: string; date?: string })[];
  sprintStart?: string;
  fronts?: Record<string, FrontMapping>;
  /** Top-level people (email + displayName) used to resolve names to contributor ids. */
  people?: { email: string; displayName?: string }[];
  /** Explicit name → contributor id overrides. */
  nameToPersonId?: Record<string, string>;
}

export interface TextFile {
  text: string;
  modifiedAt: Date;
}
export type ReadTextFile = (path: string) => Promise<TextFile>;

export class PlanCsvConnector implements Connector<PlanCsvConfig> {
  readonly type = 'plan-csv';
  readonly kind = 'plan' as const;
  constructor(
    readonly config: PlanCsvConfig,
    private readonly readText: ReadTextFile,
  ) {
    if (!config.path) throw new Error('plan-csv: "path" é obrigatório.');
  }

  async collect(ctx: ConnectorContext): Promise<SnapshotFragment> {
    const { config } = this;
    const sprintStart = config.sprintStart ? new Date(config.sprintStart) : undefined;
    const people: Record<string, string> = {};
    for (const p of config.people ?? []) {
      if (p.displayName) people[normName(p.displayName)] = `ct-${slug(p.email.toLowerCase())}`;
    }
    for (const [name, id] of Object.entries(config.nameToPersonId ?? {})) people[normName(name)] = id;

    let previous: Workstream[] = [];
    for (const entry of config.previous ?? []) {
      const path = typeof entry === 'string' ? entry : entry.path;
      const file = await this.readText(path);
      const date = typeof entry === 'string' || !entry.date ? file.modifiedAt : new Date(entry.date);
      previous = parsePlanCsv(file.text, { snapshotDate: date, sprintStart, previous, fronts: config.fronts, people });
    }
    const current = await this.readText(config.path);
    const workstreams = parsePlanCsv(current.text, {
      snapshotDate: current.modifiedAt,
      sprintStart,
      previous,
      fronts: config.fronts,
      people,
    });
    ctx.log(`Planilha: ${workstreams.length} frentes.`);
    return { workstreams, capabilities: { workstreams: 'native' } };
  }
}
