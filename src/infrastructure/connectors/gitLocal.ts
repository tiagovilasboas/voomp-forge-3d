import type { Connector, ConnectorContext, SnapshotFragment } from '@application/ports/connectors';
import {
  buildSnapshotFromGit,
  type ForgeIngestConfig,
  type RawGitCommit,
  type RawGitTag,
  type RawRepoData,
} from '../git/buildSnapshotFromGit';

/** Runs `git -C repoPath <args>` and returns stdout. Injected so the connector is testable without git. */
export type RunGit = (repoPath: string, args: string[]) => Promise<string>;

export interface GitLocalConfig extends ForgeIngestConfig {
  /** Directory that relative repository paths are resolved against. */
  baseDir?: string;
}

const RS = '\x1e';
const US = '\x1f';
const iso = (value: string) => new Date(value).toISOString();

export async function readCommits(runGit: RunGit, repoPath: string, since: Date | null): Promise<RawGitCommit[]> {
  const format = ['%H', '%P', '%an', '%ae', '%aI', '%s', '%b'].join('%x1f');
  const args = ['log', '--all', '--reverse', `--format=%x1e${format}`];
  if (since) args.push(`--since=${since.toISOString()}`);
  const out = await runGit(repoPath, args);
  return out
    .split(RS)
    .filter((r) => r.trim() !== '')
    .map((record) => {
      const [sha, parents, authorName, authorEmail, date, subject, body] = record.split(US);
      return {
        sha: sha.trim(),
        parents: parents.trim() === '' ? [] : parents.trim().split(' '),
        authorName,
        authorEmail,
        date: iso(date),
        subject,
        body: (body ?? '').trim(),
      };
    });
}

export async function readTags(runGit: RunGit, repoPath: string): Promise<RawGitTag[]> {
  const format = ['%(refname:short)', '%(objectname)', '%(*objectname)', '%(creatordate:iso-strict)'].join('%1f');
  const out = await runGit(repoPath, ['for-each-ref', `--format=${format}`, 'refs/tags']);
  return out
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((line) => {
      const [name, objectName, derefName, date] = line.split(US);
      return { name, sha: derefName || objectName, date: iso(date) };
    });
}

export class GitLocalConnector implements Connector<GitLocalConfig> {
  readonly type = 'git-local';
  readonly kind = 'vcs' as const;
  constructor(
    readonly config: GitLocalConfig,
    private readonly runGit: RunGit,
    /** Resolves a configured repo path to the path handed to `runGit`. */
    private readonly resolvePath: (path: string) => string = (p) => p,
  ) {}

  async collect(ctx: ConnectorContext): Promise<SnapshotFragment> {
    const repos: Record<string, RawRepoData> = {};
    // A zero/epoch `since` means "whole history".
    const since = ctx.since.getTime() > 0 ? ctx.since : null;
    for (const squad of this.config.squads) {
      for (const repo of squad.repositories) {
        ctx.log(`Lendo ${repo.path}…`);
        const path = this.resolvePath(repo.path);
        repos[repo.path] = { commits: await readCommits(this.runGit, path, since), tags: await readTags(this.runGit, path) };
      }
    }
    const snap = buildSnapshotFromGit({ config: this.config, repos, generatedAt: ctx.now.toISOString() });
    return {
      organization: snap.organization,
      provider: snap.source.provider,
      capabilities: snap.source.capabilities,
      squads: snap.squads,
      repositories: snap.repositories,
      contributors: snap.contributors,
      changeRequests: snap.changeRequests,
      reviews: snap.reviews,
      commits: snap.commits,
      pipelineRuns: snap.pipelineRuns,
      deployments: snap.deployments,
      initiatives: snap.initiatives,
    };
  }
}
