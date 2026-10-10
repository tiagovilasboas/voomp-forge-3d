import type { ForgeSnapshot } from '@domain/entities';
import { SNAPSHOT_SCHEMA_VERSION } from '@domain/entities';

const MAX_ISSUES = 20;

export class SnapshotValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Snapshot inválido:\n- ${issues.join('\n- ')}`);
    this.name = 'SnapshotValidationError';
    this.issues = issues;
  }
}

const SOURCE_KINDS = ['demo', 'imported', 'connected'];
const CAPABILITY = ['native', 'inferred', 'unavailable'];
const ROLES = ['developer', 'reviewer', 'tech-lead', 'product-manager'];
const CR_STATES = ['open', 'closed', 'merged'];
const CR_ORIGINS = ['provider', 'merge-commit'];
const VERDICTS = ['approved', 'changes_requested', 'commented'];
const PIPELINE_STATUS = ['running', 'success', 'failure', 'cancelled'];
const ENVIRONMENTS = ['staging', 'production'];
const DEPLOY_STATUS = ['running', 'success', 'failure'];
const INITIATIVE_STATUS = ['discovery', 'in_delivery', 'released'];
const DOC_KINDS = ['spec', 'adr', 'runbook', 'postmortem', 'guide'];

type Rec = Record<string, unknown>;

class Checker {
  readonly issues: string[] = [];

  add(message: string): void {
    this.issues.push(message);
  }

  isRec(v: unknown): v is Rec {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  obj(parent: Rec, key: string, path: string): Rec | null {
    const v = parent[key];
    if (!this.isRec(v)) {
      this.add(`${path}.${key}: esperado um objeto.`);
      return null;
    }
    return v;
  }

  str(o: Rec, key: string, path: string, opts: { allowEmpty?: boolean } = {}): string | null {
    const v = o[key];
    if (typeof v !== 'string' || (!opts.allowEmpty && v.trim() === '')) {
      this.add(`${path}.${key}: esperado texto${opts.allowEmpty ? '' : ' não vazio'}.`);
      return null;
    }
    return v;
  }

  nullableStr(o: Rec, key: string, path: string): string | null {
    const v = o[key];
    if (v === null) return null;
    if (typeof v !== 'string') this.add(`${path}.${key}: esperado texto ou null.`);
    return typeof v === 'string' ? v : null;
  }

  date(o: Rec, key: string, path: string, nullable = false): void {
    const v = o[key];
    if (nullable && v === null) return;
    if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) {
      this.add(`${path}.${key}: esperada data ISO-8601${nullable ? ' ou null' : ''}.`);
    }
  }

  num(o: Rec, key: string, path: string): void {
    if (typeof o[key] !== 'number' || !Number.isFinite(o[key])) this.add(`${path}.${key}: esperado número.`);
  }

  bool(o: Rec, key: string, path: string): void {
    if (typeof o[key] !== 'boolean') this.add(`${path}.${key}: esperado verdadeiro/falso.`);
  }

  oneOf(o: Rec, key: string, path: string, allowed: string[]): void {
    const v = o[key];
    if (typeof v !== 'string' || !allowed.includes(v)) {
      this.add(`${path}.${key}: valor "${String(v)}" inválido; use um de: ${allowed.join(', ')}.`);
    }
  }

  strArray(o: Rec, key: string, path: string): string[] {
    const v = o[key];
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
      this.add(`${path}.${key}: esperada lista de textos.`);
      return [];
    }
    return v as string[];
  }

  /** Validates that `root[key]` is an array of records and returns them. */
  list(root: Rec, key: string): Rec[] {
    const v = root[key];
    if (!Array.isArray(v)) {
      this.add(`${key}: esperada uma lista.`);
      return [];
    }
    const out: Rec[] = [];
    v.forEach((item, i) => {
      if (this.isRec(item)) out.push(item);
      else this.add(`${key}[${i}]: esperado um objeto.`);
    });
    return out;
  }

  ref(o: Rec, key: string, path: string, ids: Set<string>, target: string, nullable = false): void {
    const v = o[key];
    if (nullable && v === null) return;
    if (typeof v !== 'string') {
      this.add(`${path}.${key}: esperado id de ${target}${nullable ? ' ou null' : ''}.`);
      return;
    }
    if (!ids.has(v)) this.add(`${path}.${key}: "${v}" não existe em ${target}.`);
  }

  refs(o: Rec, key: string, path: string, ids: Set<string>, target: string): void {
    for (const v of this.strArray(o, key, path)) {
      if (!ids.has(v)) this.add(`${path}.${key}: "${v}" não existe em ${target}.`);
    }
  }

  /** Collects ids of a list, reporting missing and duplicate ids. */
  ids(items: Rec[], key: string, idField = 'id'): Set<string> {
    const seen = new Set<string>();
    items.forEach((item, i) => {
      const id = item[idField];
      if (typeof id !== 'string' || id === '') {
        this.add(`${key}[${i}].${idField}: esperado id não vazio.`);
        return;
      }
      if (seen.has(id)) this.add(`${key}[${i}].${idField}: id duplicado "${id}".`);
      seen.add(id);
    });
    return seen;
  }
}

function at(key: string, i: number): string {
  return `${key}[${i}]`;
}

/**
 * Validates an untrusted JSON value against the ForgeSnapshot contract.
 * Throws `SnapshotValidationError` with readable pt-BR issues (max 20).
 */
export function parseSnapshot(json: unknown): ForgeSnapshot {
  const c = new Checker();
  if (!c.isRec(json)) throw new SnapshotValidationError(['O arquivo não contém um objeto JSON de snapshot.']);

  if (json.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    throw new SnapshotValidationError([
      `schemaVersion: esperado ${SNAPSHOT_SCHEMA_VERSION}, recebido ${JSON.stringify(json.schemaVersion)}. Gere o snapshot novamente com a versão atual da ferramenta.`,
    ]);
  }

  validateSource(c, json);
  const org = c.obj(json, 'organization', '');
  if (org) {
    c.str(org, 'id', 'organization');
    c.str(org, 'name', 'organization');
    c.str(org, 'slug', 'organization');
  }

  const squads = c.list(json, 'squads');
  const repos = c.list(json, 'repositories');
  const contributors = c.list(json, 'contributors');
  const crs = c.list(json, 'changeRequests');
  const reviews = c.list(json, 'reviews');
  const commits = c.list(json, 'commits');
  const runs = c.list(json, 'pipelineRuns');
  const deployments = c.list(json, 'deployments');
  const initiatives = c.list(json, 'initiatives');
  const documents = c.list(json, 'documents');

  const squadIds = c.ids(squads, 'squads');
  const repoIds = c.ids(repos, 'repositories');
  const contributorIds = c.ids(contributors, 'contributors');
  const crIds = c.ids(crs, 'changeRequests');
  c.ids(reviews, 'reviews');
  c.ids(runs, 'pipelineRuns');
  c.ids(deployments, 'deployments');
  const initiativeIds = c.ids(initiatives, 'initiatives');
  c.ids(documents, 'documents');

  squads.forEach((s, i) => {
    const p = at('squads', i);
    for (const k of ['code', 'name'] as const) c.str(s, k, p);
    c.str(s, 'description', p, { allowEmpty: true });
  });

  repos.forEach((r, i) => {
    const p = at('repositories', i);
    c.ref(r, 'squadId', p, squadIds, 'squads');
    for (const k of ['name', 'fullName', 'defaultBranch'] as const) c.str(r, k, p);
    for (const k of ['description', 'language', 'webUrl'] as const) c.str(r, k, p, { allowEmpty: true });
  });

  contributors.forEach((ct, i) => {
    const p = at('contributors', i);
    c.str(ct, 'displayName', p);
    c.str(ct, 'handle', p);
    c.ref(ct, 'squadId', p, squadIds, 'squads');
    if (ct.role !== null) c.oneOf(ct, 'role', p, ROLES);
  });

  crs.forEach((cr, i) => {
    const p = at('changeRequests', i);
    c.oneOf(cr, 'origin', p, CR_ORIGINS);
    c.num(cr, 'number', p);
    c.ref(cr, 'repositoryId', p, repoIds, 'repositories');
    c.str(cr, 'title', p);
    c.nullableStr(cr, 'productSummary', p);
    c.ref(cr, 'authorId', p, contributorIds, 'contributors');
    c.oneOf(cr, 'state', p, CR_STATES);
    c.bool(cr, 'draft', p);
    c.date(cr, 'createdAt', p);
    c.date(cr, 'mergedAt', p, true);
    c.date(cr, 'closedAt', p, true);
    c.str(cr, 'headSha', p);
    c.nullableStr(cr, 'mergeCommitSha', p);
    c.str(cr, 'targetBranch', p);
    c.refs(cr, 'requestedReviewerIds', p, contributorIds, 'contributors');
    c.ref(cr, 'initiativeId', p, initiativeIds, 'initiatives', true);
    c.str(cr, 'webUrl', p, { allowEmpty: true });
    if (cr.state === 'merged' && cr.mergedAt === null) c.add(`${p}.mergedAt: mudança "merged" precisa de data de merge.`);
    if (!Array.isArray(cr.workItems)) c.add(`${p}.workItems: esperada uma lista.`);
    else {
      cr.workItems.forEach((w, j) => {
        if (!c.isRec(w)) return c.add(`${p}.workItems[${j}]: esperado um objeto.`);
        c.str(w, 'key', `${p}.workItems[${j}]`);
        c.nullableStr(w, 'url', `${p}.workItems[${j}]`);
      });
    }
  });

  reviews.forEach((r, i) => {
    const p = at('reviews', i);
    c.ref(r, 'changeRequestId', p, crIds, 'changeRequests');
    c.ref(r, 'reviewerId', p, contributorIds, 'contributors');
    c.oneOf(r, 'verdict', p, VERDICTS);
    c.date(r, 'submittedAt', p);
  });

  commits.forEach((cm, i) => {
    const p = at('commits', i);
    c.str(cm, 'sha', p);
    c.ref(cm, 'repositoryId', p, repoIds, 'repositories');
    c.ref(cm, 'authorId', p, contributorIds, 'contributors');
    c.str(cm, 'message', p, { allowEmpty: true });
    c.date(cm, 'committedAt', p);
    c.ref(cm, 'changeRequestId', p, crIds, 'changeRequests', true);
    c.str(cm, 'webUrl', p, { allowEmpty: true });
  });

  runs.forEach((r, i) => {
    const p = at('pipelineRuns', i);
    c.ref(r, 'repositoryId', p, repoIds, 'repositories');
    c.str(r, 'pipelineName', p);
    c.str(r, 'headSha', p);
    c.str(r, 'branch', p, { allowEmpty: true });
    c.ref(r, 'changeRequestId', p, crIds, 'changeRequests', true);
    c.oneOf(r, 'status', p, PIPELINE_STATUS);
    c.date(r, 'startedAt', p);
    c.str(r, 'webUrl', p, { allowEmpty: true });
  });

  deployments.forEach((d, i) => {
    const p = at('deployments', i);
    c.ref(d, 'repositoryId', p, repoIds, 'repositories');
    c.oneOf(d, 'environment', p, ENVIRONMENTS);
    c.str(d, 'sha', p);
    c.str(d, 'ref', p, { allowEmpty: true });
    c.date(d, 'createdAt', p);
    c.oneOf(d, 'status', p, DEPLOY_STATUS);
    c.refs(d, 'changeRequestIds', p, crIds, 'changeRequests');
    c.str(d, 'webUrl', p, { allowEmpty: true });
  });

  initiatives.forEach((ini, i) => {
    const p = at('initiatives', i);
    c.str(ini, 'key', p);
    c.str(ini, 'name', p);
    c.str(ini, 'summary', p, { allowEmpty: true });
    c.ref(ini, 'ownerSquadId', p, squadIds, 'squads');
    c.oneOf(ini, 'status', p, INITIATIVE_STATUS);
  });

  documents.forEach((d, i) => {
    const p = at('documents', i);
    c.str(d, 'title', p);
    c.oneOf(d, 'kind', p, DOC_KINDS);
    c.str(d, 'space', p, { allowEmpty: true });
    c.ref(d, 'squadId', p, squadIds, 'squads', true);
    c.refs(d, 'initiativeIds', p, initiativeIds, 'initiatives');
    c.refs(d, 'repositoryIds', p, repoIds, 'repositories');
    c.date(d, 'updatedAt', p);
    c.str(d, 'webUrl', p, { allowEmpty: true });
  });

  if (c.issues.length > 0) {
    const shown = c.issues.slice(0, MAX_ISSUES);
    if (c.issues.length > MAX_ISSUES) shown[MAX_ISSUES - 1] = `… e mais ${c.issues.length - MAX_ISSUES + 1} problemas.`;
    throw new SnapshotValidationError(shown);
  }
  return json as unknown as ForgeSnapshot;
}

function validateSource(c: Checker, json: Rec): void {
  const source = c.obj(json, 'source', '');
  if (!source) return;
  c.oneOf(source, 'kind', 'source', SOURCE_KINDS);
  c.date(source, 'generatedAt', 'source');
  const provider = c.obj(source, 'provider', 'source');
  if (provider) {
    c.str(provider, 'id', 'source.provider');
    c.str(provider, 'name', 'source.provider');
    const vocab = c.obj(provider, 'vocabulary', 'source.provider');
    if (vocab) for (const k of ['changeRequest', 'changeRequestShort', 'pipeline'] as const) c.str(vocab, k, 'source.provider.vocabulary');
  }
  const caps = c.obj(source, 'capabilities', 'source');
  if (caps) {
    for (const k of ['changeRequests', 'reviews', 'pipelines', 'deployments', 'documents'] as const) {
      c.oneOf(caps, k, 'source.capabilities', CAPABILITY);
    }
  }
}
