/**
 * Voomp Forge ingestion CLI (thin IO around the pure builder).
 *
 *   npm run ingest -- --config forge.config.json --out public/snapshot.json [--since 30]
 *
 * Runs every connector of forge.config.json (git-local, jira, plan-csv, confluence), merges
 * their fragments and writes a validated ForgeSnapshot JSON. See docs/INGESTION.md.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { mergeFragments } from '@application/contracts/mergeFragments';
import { parseSnapshot } from '@application/contracts/parseSnapshot';
import type { ConnectorContext, SnapshotFragment } from '@application/ports/connectors';
import { connectorBlocks } from '@infrastructure/connectors/config';
import { buildConnectors, createRegistry } from '@infrastructure/connectors/registry';

const run = promisify(execFile);

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

async function runGit(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-C', repoPath, ...args], { maxBuffer: 512 * 1024 * 1024 });
  return stdout;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(await readFile(args.config, 'utf8')) as Record<string, unknown>;
  const configDir = dirname(resolve(args.config));
  const abs = (p: string) => resolve(configDir, p);

  const registry = createRegistry({
    runGit,
    resolvePath: abs,
    readText: async (path) => {
      const file = abs(path);
      return { text: await readFile(file, 'utf8'), modifiedAt: (await stat(file)).mtime };
    },
  });
  const blocks = connectorBlocks(config);
  const connectors = buildConnectors(blocks, registry);

  const now = new Date();
  const ctx: ConnectorContext = {
    now,
    since: args.since === null ? new Date(0) : new Date(now.getTime() - args.since * 86_400_000),
    secret: (name) => process.env[name],
    log: (message) => process.stderr.write(`${message}\n`),
  };

  const fragments: SnapshotFragment[] = [];
  for (const connector of connectors) {
    process.stderr.write(`Conector ${connector.type}…\n`);
    fragments.push(await connector.collect(ctx));
  }

  const snapshot = mergeFragments(fragments, now);
  parseSnapshot(JSON.parse(JSON.stringify(snapshot)));

  await mkdir(dirname(resolve(args.out)), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stderr.write(
    `Snapshot gerado em ${args.out}: ${snapshot.repositories.length} repositórios, ${snapshot.changeRequests.length} mudanças, ` +
      `${snapshot.commits.length} commits, ${snapshot.deployments.length} deploys, ${snapshot.workItems.length} tarefas, ` +
      `${snapshot.workstreams.length} frentes, ${snapshot.documents.length} documentos.\n`,
  );
}

main().catch((e: unknown) => {
  process.stderr.write(`Erro: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
