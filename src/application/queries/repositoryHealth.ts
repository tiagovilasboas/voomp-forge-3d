import type { Deployment, ID, ISODate, PipelineRun } from '@domain/entities';
import type { ForgeIndex } from './forgeIndex';
import { toDelivery } from './deliveries';
import { inPeriod, latest, withinHours, type ScopeFilter } from './period';

/**
 * Visual language shared by the scene and the HUD. Each signal always ships
 * with a text label + icon in the UI; colour alone never carries meaning.
 */
export type Signal = 'active' | 'success' | 'attention' | 'error' | 'idle' | 'unknown';

export type ModuleId = 'changes' | 'pipeline' | 'deploy' | 'commits';

export interface RackModule {
  id: ModuleId;
  signal: Signal;
  label: string;
}

export interface RepositoryHealth {
  repoId: ID;
  /** Any activity in the last 48h → the rack pulses. */
  hot: boolean;
  /** No activity at all in the period → the rack goes grey. */
  idle: boolean;
  lastActivityAt: ISODate | null;
  pipeline: { signal: Signal; latest: PipelineRun | null };
  lastDeployment: Deployment | null;
  openChanges: number;
  blockedChanges: number;
  alert: boolean;
  modules: RackModule[];
}

const RECENT_HOURS = 48;

const PIPELINE_LABEL: Record<PipelineRun['status'], string> = {
  success: 'sucesso',
  failure: 'falhou',
  running: 'em execução',
  cancelled: 'cancelado',
};
const DEPLOY_LABEL: Record<Deployment['status'], string> = { success: 'sucesso', failure: 'falhou', running: 'em andamento' };

function pipelineSignal(run: PipelineRun | null): Signal {
  if (!run) return 'unknown';
  if (run.status === 'failure') return 'error';
  if (run.status === 'running') return 'active';
  if (run.status === 'success') return 'success';
  return 'idle';
}

export function repositoryHealth(idx: ForgeIndex, repoId: ID, scope: ScopeFilter): RepositoryHealth {
  const crs = idx.crsByRepo.get(repoId) ?? [];
  const runs = idx.runsByRepo.get(repoId) ?? [];
  const deploys = idx.deploymentsByRepo.get(repoId) ?? [];
  const commits = idx.commitsByRepo.get(repoId) ?? [];
  const defaultBranch = idx.repo.get(repoId)?.defaultBranch;

  const lastActivityAt = latest([
    commits[0]?.committedAt,
    crs[0]?.createdAt,
    ...crs.map((c) => c.mergedAt),
    runs[0]?.startedAt,
    deploys[0]?.createdAt,
  ]);

  const open = crs.filter((c) => c.state === 'open').map((c) => toDelivery(idx, c));
  const blocked = open.filter((d) => d.status === 'ci_failed' || d.status === 'changes_requested').length;
  const awaiting = open.filter((d) => d.status === 'awaiting_review').length;

  // Repository CI health follows the default branch; failing CR branches show up as blocked changes.
  const latestRun = runs.find((r) => r.branch === defaultBranch) ?? runs[0] ?? null;
  const pipeline = pipelineSignal(latestRun);
  const lastDeployment = deploys[0] ?? null;
  const idle = !inPeriod(scope, lastActivityAt);

  const changesSignal: Signal = blocked ? 'error' : awaiting ? 'attention' : open.length ? 'active' : idle ? 'idle' : 'success';
  const deploySignal: Signal = !lastDeployment
    ? 'unknown'
    : lastDeployment.status === 'failure'
      ? 'error'
      : lastDeployment.status === 'running'
        ? 'active'
        : lastDeployment.environment === 'production'
          ? 'success'
          : 'attention';
  const commitsInPeriod = commits.filter((c) => inPeriod(scope, c.committedAt)).length;

  return {
    repoId,
    hot: withinHours(scope.now, lastActivityAt, RECENT_HOURS),
    idle,
    lastActivityAt,
    pipeline: { signal: pipeline, latest: latestRun },
    lastDeployment,
    openChanges: open.length,
    blockedChanges: blocked,
    alert: pipeline === 'error' || blocked > 0 || deploySignal === 'error',
    modules: [
      { id: 'changes', signal: changesSignal, label: `${open.length} abertas · ${awaiting} aguardando revisão` },
      { id: 'pipeline', signal: pipeline, label: latestRun ? `Último pipeline: ${PIPELINE_LABEL[latestRun.status]}` : 'Sem dados de pipeline' },
      {
        id: 'deploy',
        signal: deploySignal,
        label: lastDeployment ? `Último deploy: ${lastDeployment.environment} (${DEPLOY_LABEL[lastDeployment.status]})` : 'Nenhum deploy conhecido',
      },
      { id: 'commits', signal: commitsInPeriod ? 'active' : 'idle', label: `${commitsInPeriod} commits no período` },
    ],
  };
}
