import type { Connector, ConnectorContext, SnapshotFragment } from '@application/ports/connectors';
import type { DocumentKind, KnowledgeDocument } from '@domain/entities';
import { basicAuthHeaders, defaultFetchJson, trimSlash, type FetchJson } from './http';

export interface ConfluenceConfig {
  baseUrl: string;
  spaceKeys: string[];
  labelToInitiative?: Record<string, string>;
  labelToRepo?: Record<string, string>;
}

interface ConfluenceRaw {
  id: string;
  title: string;
  space?: { key?: string };
  version?: { when?: string };
  metadata?: { labels?: { results?: { name: string }[] } };
  _links?: { webui?: string };
}

const KIND_LABELS: [DocumentKind, string[]][] = [
  ['adr', ['adr']],
  ['runbook', ['runbook']],
  ['postmortem', ['postmortem', 'post-mortem']],
  ['spec', ['spec']],
  ['guide', ['guide']],
];

export function kindFromLabels(labels: string[]): DocumentKind {
  const set = new Set(labels.map((l) => l.toLowerCase()));
  return KIND_LABELS.find(([, names]) => names.some((n) => set.has(n)))?.[0] ?? 'guide';
}

/** Pure: Confluence content JSON → KnowledgeDocument. Links come only from configured labels. */
export function mapConfluencePage(raw: ConfluenceRaw, config: ConfluenceConfig): KnowledgeDocument {
  const labels = (raw.metadata?.labels?.results ?? []).map((l) => l.name);
  const pick = (map: Record<string, string> | undefined) => [...new Set(labels.flatMap((l) => (map?.[l] ? [map[l]] : [])))];
  const when = raw.version?.when ? new Date(raw.version.when) : null;
  return {
    id: `doc-confluence-${raw.id}`,
    title: raw.title,
    kind: kindFromLabels(labels),
    space: raw.space?.key ?? '',
    squadId: null,
    initiativeIds: pick(config.labelToInitiative),
    repositoryIds: pick(config.labelToRepo),
    updatedAt: when && !Number.isNaN(when.getTime()) ? when.toISOString() : new Date(0).toISOString(),
    webUrl: `${trimSlash(config.baseUrl)}/wiki${raw._links?.webui ?? `/pages/viewpage.action?pageId=${raw.id}`}`,
  };
}

export class ConfluenceConnector implements Connector<ConfluenceConfig> {
  readonly type = 'confluence';
  readonly kind = 'knowledge' as const;
  constructor(
    readonly config: ConfluenceConfig,
    private readonly fetchJson: FetchJson = defaultFetchJson,
  ) {
    if (!config.baseUrl) throw new Error('confluence: "baseUrl" é obrigatório.');
    if (!config.spaceKeys?.length) throw new Error('confluence: informe ao menos um item em "spaceKeys".');
  }

  async collect(ctx: ConnectorContext): Promise<SnapshotFragment> {
    const { config } = this;
    const headers = basicAuthHeaders(ctx, 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN', ['JIRA_EMAIL', 'JIRA_API_TOKEN']);
    const limit = 100;
    const documents: KnowledgeDocument[] = [];
    for (const space of config.spaceKeys) {
      let start = 0;
      for (;;) {
        const url =
          `${trimSlash(config.baseUrl)}/wiki/rest/api/content?spaceKey=${encodeURIComponent(space)}&type=page` +
          `&expand=${encodeURIComponent('metadata.labels,version,space')}&start=${start}&limit=${limit}`;
        const page = (await this.fetchJson(url, headers)) as { results?: ConfluenceRaw[]; size?: number };
        const results = page.results ?? [];
        for (const r of results) documents.push(mapConfluencePage(r, config));
        start += results.length;
        if (results.length < limit) break;
      }
    }
    ctx.log(`Confluence: ${documents.length} páginas.`);
    return { documents, capabilities: { documents: 'native' } };
  }
}
