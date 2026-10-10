/**
 * Voomp Forge ingestion CLI (thin IO around the pure builder).
 *
 *   npm run ingest -- --config forge.config.json --out public/snapshot.json [--since 30]
 *
 * Reads plain git history of local clones (read-only `git log` / `git for-each-ref`)
 * and writes a ForgeSnapshot JSON. See docs/INGESTION.md.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { parseSnapshot } from '@application/contracts/parseSnapshot';
import {
  buildSnapshotFromGit,
  type ForgeIngestConfig,
  type RawGitCommit,
  type RawGitTag,
  type RawRepoData,
} from '@infrastructure/git/buildSnapshotFromGit';

const run = promisify(execFile);
const RS = '\x1e';
const US = '\x1f';

function parseArgs(argv: string[]): { config: string; out: string; since: number | null } {
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Argumento inválido: ${key ?? ''}`);
    opts.set(key.slice(2), value);
  }
  const config = opts.get('config');
  const out = opts.get('out');
  if (!config || !out) throw new Error('Uso: npm run ingest -- --config forge.config.json --out public/snapshot.json [--since 30]');
  const since = opts.has('since') ? Number(opts.get('since')) : null;
  if (since !== null && (!Number.isFinite(since) || since <= 0)) throw new Error('--since deve ser um número positivo de dias.');
  return { config, out, since };
}

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-C', repoPath, ...args], { maxBuffer: 512 * 1024 * 1024 });
  return stdout;
}

const iso = (value: string) => new Date(value).toISOString();

async function readCommits(repoPath: string, since: number | null): Promise<RawGitCommit[]> {
  const format = ['%H', '%P', '%an', '%ae', '%aI', '%s', '%b'].join('%x1f');
  const args = ['log', '--all', '--reverse', `--format=%x1e${format}`];
  if (since !== null) args.push(`--since=${since} days ago`);
  const out = await git(repoPath, args);
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

async function readTags(repoPath: string): Promise<RawGitTag[]> {
  const format = ['%(refname:short)', '%(objectname)', '%(*objectname)', '%(creatordate:iso-strict)'].join('%1f');
  const out = await git(repoPath, ['for-each-ref', `--format=${format}`, 'refs/tags']);
  return out
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((line) => {
      const [name, objectName, derefName, date] = line.split(US);
      return { name, sha: derefName || objectName, date: iso(date) };
    });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(await readFile(args.config, 'utf8')) as ForgeIngestConfig;
  const configDir = dirname(resolve(args.config));

  const repos: Record<string, RawRepoData> = {};
  for (const squad of config.squads) {
    for (const repo of squad.repositories) {
      const path = resolve(configDir, repo.path);
      process.stderr.write(`Lendo ${repo.path}…\n`);
      repos[repo.path] = { commits: await readCommits(path, args.since), tags: await readTags(path) };
    }
  }

  const snapshot = buildSnapshotFromGit({ config, repos, generatedAt: new Date().toISOString() });
  parseSnapshot(JSON.parse(JSON.stringify(snapshot)));

  await mkdir(dirname(resolve(args.out)), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stderr.write(
    `Snapshot gerado em ${args.out}: ${snapshot.repositories.length} repositórios, ${snapshot.changeRequests.length} mudanças, ` +
      `${snapshot.commits.length} commits, ${snapshot.deployments.length} deploys.\n`,
  );
}

main().catch((e: unknown) => {
  process.stderr.write(`Erro: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
