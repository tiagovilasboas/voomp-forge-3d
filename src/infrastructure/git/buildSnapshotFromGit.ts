import type {
  ChangeRequest,
  Commit,
  Contributor,
  ContributorRole,
  Deployment,
  DeploymentEnvironment,
  ForgeSnapshot,
  InitiativeStatus,
  ProductInitiative,
  ProviderVocabulary,
  Repository,
  Squad,
} from '@domain/entities';
import { SNAPSHOT_SCHEMA_VERSION } from '@domain/entities';
import { parseMergeMessage, type MergeInfo } from './mergeMessages';
import { extractWorkItems } from './workItems';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface GitRepoConfig {
  path: string;
  name?: string;
  webUrl?: string;
  defaultBranch?: string;
  language?: string;
}

export interface GitSquadConfig {
  id: string;
  code: string;
  name: string;
  description?: string;
  repositories: GitRepoConfig[];
}

export interface GitPersonConfig {
  email: string;
  displayName?: string;
  handle?: string;
  role?: ContributorRole;
  squadId?: string;
}

export interface GitInitiativeConfig {
  key: string;
  name: string;
  summary?: string;
  ownerSquadId?: string;
  status?: InitiativeStatus;
}

export interface DeploymentTagRule {
  environment: DeploymentEnvironment;
  /** Regex source matched against the tag name. */
  tagPattern: string;
}

export interface ForgeIngestConfig {
  organization: { id?: string; name: string; slug?: string };
  provider?: { name?: string; vocabulary?: Partial<ProviderVocabulary> };
  squads: GitSquadConfig[];
  people?: GitPersonConfig[];
  initiatives?: GitInitiativeConfig[];
  /** Regex source (e.g. "INI-\\d+") whose match is looked up in `initiatives[].key`. */
  initiativePattern?: string;
  workItemPattern?: string;
  /** e.g. "https://tracker/browse/{key}" */
  workItemUrlTemplate?: string;
  deployments?: DeploymentTagRule[];
  /** Optional "{webUrl}/pull/{number}"; default links to the merge commit. */
  changeRequestUrlTemplate?: string;
  /** Default "{webUrl}/commit/{sha}". */
  commitUrlTemplate?: string;
}

export interface RawGitCommit {
  sha: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  /** ISO-8601 */
  date: string;
  subject: string;
  body: string;
}

export interface RawGitTag {
  name: string;
  /** Commit the tag points to (annotated tags already dereferenced). */
  sha: string;
  date: string;
}

export interface RawRepoData {
  commits: RawGitCommit[];
  tags: RawGitTag[];
}

export interface BuildSnapshotInput {
  config: ForgeIngestConfig;
  /** Raw git data keyed by `GitRepoConfig.path`. */
  repos: Record<string, RawRepoData>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_VOCABULARY: ProviderVocabulary = { changeRequest: 'Merge', changeRequestShort: 'Merge', pipeline: 'Pipeline' };

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

function baseName(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}

/** All commits reachable from `start` (inclusive) within `known`. */
function ancestors(start: string, graph: Map<string, RawGitCommit>): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const sha = stack.pop()!;
    if (seen.has(sha)) continue;
    const c = graph.get(sha);
    if (!c) continue;
    seen.add(sha);
    for (const p of c.parents) stack.push(p);
  }
  return seen;
}

interface InferredChange {
  cr: ChangeRequest;
  branchShas: string[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** Pure: turns raw git history + config into a ForgeSnapshot. No IO. */
export function buildSnapshotFromGit(input: BuildSnapshotInput): ForgeSnapshot {
  const { config } = input;
  if (config.squads.length === 0) throw new Error('A configuração precisa de ao menos uma squad.');
  const squadIds = new Set(config.squads.map((s) => s.id));
  const firstSquadId = config.squads[0].id;

  const squads: Squad[] = config.squads.map((s) => ({ id: s.id, code: s.code, name: s.name, description: s.description ?? '' }));
  const initiatives: ProductInitiative[] = (config.initiatives ?? []).map((i) => ({
    id: `ini-${slug(i.key)}`,
    key: i.key,
    name: i.name,
    summary: i.summary ?? '',
    ownerSquadId: i.ownerSquadId && squadIds.has(i.ownerSquadId) ? i.ownerSquadId : firstSquadId,
    status: i.status ?? 'in_delivery',
  }));
  const initiativeByKey = new Map(initiatives.map((i) => [i.key, i]));
  const initiativeRe = config.initiativePattern ? new RegExp(config.initiativePattern) : null;

  for (const rule of config.deployments ?? []) {
    if (rule.environment !== 'staging' && rule.environment !== 'production') {
      throw new Error(`Ambiente de deploy inválido "${String(rule.environment)}"; use staging ou production.`);
    }
  }
  const people = new Map((config.people ?? []).map((p) => [p.email.toLowerCase(), p]));
  for (const p of people.values()) {
    if (p.squadId && !squadIds.has(p.squadId)) throw new Error(`people: squadId "${p.squadId}" (${p.email}) não existe em squads.`);
  }

  const repositories: Repository[] = [];
  const commits: Commit[] = [];
  const changeRequests: ChangeRequest[] = [];
  const deployments: Deployment[] = [];
  /** email(lower) -> info gathered from commits */
  const seen = new Map<string, { name: string; date: string; bySquad: Map<string, number> }>();

  const commitUrlTemplate = config.commitUrlTemplate ?? '{webUrl}/commit/{sha}';

  for (const squad of config.squads) {
    for (const repoCfg of squad.repositories) {
      const name = repoCfg.name ?? baseName(repoCfg.path);
      const repoId = `repo-${slug(name)}`;
      const webUrl = repoCfg.webUrl?.replace(/\/+$/, '') ?? '';
      const defaultBranch = repoCfg.defaultBranch ?? 'main';
      repositories.push({
        id: repoId,
        squadId: squad.id,
        name,
        fullName: name,
        description: '',
        defaultBranch,
        language: repoCfg.language ?? '',
        webUrl,
      });

      const raw = input.repos[repoCfg.path] ?? { commits: [], tags: [] };
      const graph = new Map(raw.commits.map((c) => [c.sha, c]));
      const urlFor = (template: string, v: Record<string, string | number>) => (webUrl ? fill(template, { webUrl, ...v }) : '');

      for (const c of raw.commits) {
        const key = c.authorEmail.toLowerCase();
        const entry = seen.get(key) ?? { name: c.authorName, date: '', bySquad: new Map() };
        if (c.date >= entry.date) {
          entry.date = c.date;
          entry.name = c.authorName;
        }
        entry.bySquad.set(squad.id, (entry.bySquad.get(squad.id) ?? 0) + 1);
        seen.set(key, entry);
      }
      const authorId = (email: string) => `ct-${slug(email.toLowerCase())}`;

      // --- change requests inferred from merge / squash commits ---
      const inferred: InferredChange[] = [];
      const usedNumbers = new Set<number>();
      const merges = raw.commits
        .map((c) => ({ c, info: parseMergeMessage(c.subject, c.body) }))
        .filter((x): x is { c: RawGitCommit; info: MergeInfo } => x.info !== null && (x.c.parents.length >= 2 || x.info.kind === 'squash'))
        .sort((a, b) => a.c.date.localeCompare(b.c.date) || a.c.sha.localeCompare(b.c.sha));

      for (const { c, info } of merges) {
        if (usedNumbers.has(info.number)) continue;
        usedNumbers.add(info.number);

        let branchShas = [c.sha];
        if (c.parents.length >= 2) {
          const mainline = ancestors(c.parents[0], graph);
          branchShas = [...ancestors(c.parents[1], graph)].filter((s) => !mainline.has(s));
        }
        const branchCommits = branchShas
          .map((s) => graph.get(s)!)
          .sort((a, b) => a.date.localeCompare(b.date) || a.sha.localeCompare(b.sha));
        const first = branchCommits[0];
        const title = info.title ?? info.sourceBranch ?? c.subject;
        const searchable = [title, info.sourceBranch, c.subject, c.body];
        const initiativeKey = initiativeRe ? searchable.map((t) => t?.match(initiativeRe)?.[0]).find(Boolean) : undefined;
        const initiative = initiativeKey ? initiativeByKey.get(initiativeKey) : undefined;

        const cr: ChangeRequest = {
          id: `cr-${repoId}-${info.number}`,
          origin: 'merge-commit',
          number: info.number,
          repositoryId: repoId,
          title,
          productSummary: null,
          authorId: authorId((first ?? c).authorEmail),
          state: 'merged',
          draft: false,
          createdAt: first?.date ?? c.date,
          mergedAt: c.date,
          closedAt: null,
          headSha: c.parents.length >= 2 ? c.parents[1] : c.sha,
          mergeCommitSha: c.sha,
          targetBranch: info.targetBranch ?? defaultBranch,
          requestedReviewerIds: [],
          initiativeId: initiative?.id ?? null,
          workItems: extractWorkItems([title, info.sourceBranch], { pattern: config.workItemPattern, urlTemplate: config.workItemUrlTemplate })
            .filter((w) => !initiativeByKey.has(w.key)),
          webUrl: config.changeRequestUrlTemplate
            ? urlFor(config.changeRequestUrlTemplate, { number: info.number, sha: c.sha })
            : urlFor(commitUrlTemplate, { sha: c.sha }),
        };
        inferred.push({ cr, branchShas });
        changeRequests.push(cr);
      }

      // --- commits, attributed to the first (earliest merged) change that contains them ---
      const crOfCommit = new Map<string, string>();
      for (const { cr, branchShas } of inferred) {
        for (const s of branchShas) if (!crOfCommit.has(s)) crOfCommit.set(s, cr.id);
        if (cr.mergeCommitSha && !crOfCommit.has(cr.mergeCommitSha)) crOfCommit.set(cr.mergeCommitSha, cr.id);
      }
      for (const c of raw.commits) {
        commits.push({
          sha: c.sha,
          repositoryId: repoId,
          authorId: authorId(c.authorEmail),
          message: c.subject,
          committedAt: c.date,
          changeRequestId: crOfCommit.get(c.sha) ?? null,
          webUrl: urlFor(commitUrlTemplate, { sha: c.sha }),
        });
      }

      // --- deployments from tags ---
      const rules = (config.deployments ?? []).map((r) => ({ env: r.environment, re: new RegExp(r.tagPattern) }));
      for (const env of ['staging', 'production'] as const) {
        const envRules = rules.filter((r) => r.env === env);
        if (envRules.length === 0) continue;
        const tags = raw.tags
          .filter((t) => envRules.some((r) => r.re.test(t.name)) && graph.has(t.sha))
          .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
        let previous = new Set<string>();
        for (const tag of tags) {
          const reachable = ancestors(tag.sha, graph);
          const crIds = inferred
            .filter(({ cr }) => cr.mergeCommitSha !== null && reachable.has(cr.mergeCommitSha) && !previous.has(cr.mergeCommitSha))
            .map(({ cr }) => cr.id);
          deployments.push({
            id: `dep-${repoId}-${env}-${slug(tag.name)}`,
            repositoryId: repoId,
            environment: env,
            sha: tag.sha,
            ref: tag.name,
            createdAt: tag.date,
            status: 'success',
            changeRequestIds: crIds,
            webUrl: webUrl ? `${webUrl}/releases/tag/${encodeURIComponent(tag.name)}` : '',
          });
          previous = reachable;
        }
      }
    }
  }

  // --- contributors: commit authors + configured people, deduped by lowercased email ---
  const emails = new Set<string>([...seen.keys(), ...people.keys()]);
  const contributors: Contributor[] = [...emails].sort().map((email) => {
    const cfg = people.get(email);
    const info = seen.get(email);
    const topSquad = info ? [...info.bySquad.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] : undefined;
    return {
      id: `ct-${slug(email)}`,
      displayName: cfg?.displayName ?? info?.name ?? email,
      handle: cfg?.handle ?? email.split('@')[0],
      squadId: cfg?.squadId ?? topSquad ?? firstSquadId,
      role: cfg?.role ?? null,
    };
  });

  const orgName = config.organization.name;
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    source: {
      kind: 'imported',
      provider: {
        id: 'git',
        name: config.provider?.name ?? 'Git',
        vocabulary: { ...DEFAULT_VOCABULARY, ...config.provider?.vocabulary },
      },
      capabilities: {
        changeRequests: 'inferred',
        reviews: 'unavailable',
        pipelines: 'unavailable',
        deployments: (config.deployments ?? []).length > 0 ? 'inferred' : 'unavailable',
        documents: 'unavailable',
      },
      generatedAt: input.generatedAt,
    },
    organization: { id: config.organization.id ?? `org-${slug(orgName)}`, name: orgName, slug: config.organization.slug ?? slug(orgName) },
    squads,
    repositories,
    contributors,
    changeRequests,
    reviews: [],
    commits,
    pipelineRuns: [],
    deployments,
    initiatives,
    documents: [],
  };
}
