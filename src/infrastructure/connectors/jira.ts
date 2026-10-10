import type { Connector, ConnectorContext, SnapshotFragment } from '@application/ports/connectors';
import type { WorkItem, WorkItemStatus, WorkItemType } from '@domain/entities';
import { assertSafeBaseUrl, basicAuthHeaders, defaultFetchJson, MAX_PAGES, trimSlash, type FetchJson } from './http';

export interface JiraConfig {
  baseUrl: string;
  project?: string;
  jql?: string;
  /** Custom field id holding the epic key on classic projects, e.g. "customfield_10014". */
  epicLinkField?: string;
  /** Custom field id holding sprints, e.g. "customfield_10020". */
  sprintField?: string;
  /** Status names that mean "in production", e.g. ["Em Produção", "Deployed"]. */
  productionStatuses: string[];
  /** Also treat a released fix version's release date as production evidence. */
  productionByFixVersionReleased?: boolean;
}

interface JiraRaw {
  key: string;
  fields?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const toIso = (v: unknown): string | null => {
  if (typeof v !== 'string' || v === '') return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};

function mapType(name: string): WorkItemType {
  const n = norm(name);
  if (n.includes('epic')) return 'epic';
  if (n.includes('bug') || n.includes('defeito')) return 'bug';
  if (n.includes('stor') || n.includes('historia')) return 'story';
  return 'task';
}

function mapStatus(categoryKey: unknown): WorkItemStatus {
  if (categoryKey === 'done') return 'done';
  if (categoryKey === 'indeterminate') return 'in_progress';
  return 'todo';
}

/** Picks the active sprint, else the last one. Accepts objects or the legacy "…name=Sprint 4,…" string. */
function sprintName(value: unknown): string | null {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const parsed = list
    .map((s) => {
      if (typeof s === 'string') {
        const m = /name=([^,\]]+)/.exec(s);
        const st = /state=([^,\]]+)/.exec(s);
        return { name: m ? m[1] : s, state: st?.[1] };
      }
      if (s && typeof s === 'object') return { name: String((s as any).name ?? ''), state: (s as any).state as string | undefined }; // eslint-disable-line @typescript-eslint/no-explicit-any
      return null;
    })
    .filter((s): s is { name: string; state: string | undefined } => !!s && s.name !== '');
  if (parsed.length === 0) return null;
  return (parsed.find((s) => s.state === 'active') ?? parsed[parsed.length - 1]).name;
}

/** Pure: Jira issue JSON → WorkItem. Production evidence only when the tracker says so. */
export function mapJiraIssue(raw: JiraRaw, config: JiraConfig): WorkItem {
  const f = raw.fields ?? {};
  const statusName: string = f.status?.name ?? '';
  const status = mapStatus(f.status?.statusCategory?.key);

  let epicKey: string | null = null;
  const parent = f.parent;
  if (parent?.key) {
    const parentType = parent.fields?.issuetype?.name;
    if (!parentType || mapType(parentType) === 'epic') epicKey = parent.key;
  }
  if (!epicKey && config.epicLinkField && typeof f[config.epicLinkField] === 'string') epicKey = f[config.epicLinkField];

  const updatedAt = toIso(f.updated) ?? toIso(f.created) ?? new Date(0).toISOString();

  let productionAt: string | null = null;
  const isProdStatus = config.productionStatuses.some((s) => norm(s) === norm(statusName));
  if (isProdStatus) productionAt = toIso(f.statuscategorychangedate) ?? toIso(f.resolutiondate);
  if (!productionAt && config.productionByFixVersionReleased) {
    const dates = ((f.fixVersions as any[]) ?? []) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((v) => v?.released === true)
      .map((v) => toIso(v.releaseDate))
      .filter((d): d is string => d !== null)
      .sort();
    if (dates.length > 0) productionAt = dates[dates.length - 1];
  }

  return {
    key: raw.key,
    title: f.summary ?? raw.key,
    type: mapType(f.issuetype?.name ?? ''),
    status,
    statusName,
    epicKey,
    sprint: config.sprintField ? sprintName(f[config.sprintField]) : null,
    updatedAt,
    productionAt,
    url: `${trimSlash(config.baseUrl)}/browse/${raw.key}`,
  };
}

export function jiraFields(config: JiraConfig): string[] {
  return [
    'summary', 'issuetype', 'status', 'parent', 'updated', 'created', 'statuscategorychangedate', 'resolutiondate', 'fixVersions',
    ...(config.epicLinkField ? [config.epicLinkField] : []),
    ...(config.sprintField ? [config.sprintField] : []),
  ];
}

export class JiraConnector implements Connector<JiraConfig> {
  readonly type = 'jira';
  readonly kind = 'tracker' as const;
  constructor(
    readonly config: JiraConfig,
    private readonly fetchJson: FetchJson = defaultFetchJson,
  ) {
    if (!config.baseUrl) throw new Error('jira: "baseUrl" é obrigatório.');
    assertSafeBaseUrl('jira', config.baseUrl);
    if (!config.jql && !config.project) throw new Error('jira: informe "project" ou "jql".');
  }

  async collect(ctx: ConnectorContext): Promise<SnapshotFragment> {
    const { config } = this;
    const headers = basicAuthHeaders(ctx, 'JIRA_EMAIL', 'JIRA_API_TOKEN');
    const jql = config.jql ?? `project = "${config.project}" ORDER BY key ASC`;
    const pageSize = 100;
    const items: WorkItem[] = [];
    let startAt = 0;
    for (let pages = 0; ; pages++) {
      if (pages >= MAX_PAGES) throw new Error(`jira: limite de ${MAX_PAGES} páginas excedido.`);
      const url =
        `${trimSlash(config.baseUrl)}/rest/api/3/search?jql=${encodeURIComponent(jql)}` +
        `&fields=${encodeURIComponent(jiraFields(config).join(','))}&startAt=${startAt}&maxResults=${pageSize}`;
      const page = (await this.fetchJson(url, headers)) as { issues?: JiraRaw[]; total?: number };
      const issues = Array.isArray(page.issues) ? page.issues : [];
      for (const issue of issues) items.push(mapJiraIssue(issue, config));
      startAt += issues.length;
      if (issues.length === 0 || startAt >= (page.total ?? 0)) break;
    }
    ctx.log(`Jira: ${items.length} itens.`);
    return { workItems: items, capabilities: { workItems: 'native' } };
  }
}
