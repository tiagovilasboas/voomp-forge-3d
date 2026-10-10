import type { ChangeRequest, Deployment, ISODate, PipelineRun, Review, SourceCapabilities } from '@domain/entities';

/**
 * Evidence rules for a change request. The single source of truth for
 * "how far did this change get". A stage is only `done` when a concrete
 * record proves it — merged ≠ deployed ≠ in production.
 */

export interface ChangeRequestEvidence {
  changeRequest: ChangeRequest;
  reviews: Review[];
  /** Runs whose headSha matches the change request head. */
  headRuns: PipelineRun[];
  /** Deployments that list this change request in `changeRequestIds`. */
  deployments: Deployment[];
  /** What the source can know. Missing knowledge yields `unknown`, never `pending` or `done`. */
  capabilities: SourceCapabilities;
}

export type StageId = 'opened' | 'in_review' | 'approved' | 'merged' | 'deployed' | 'production';
/** `unknown` = the source cannot tell (e.g. plain Git has no reviews or deployments). */
export type StageState = 'done' | 'blocked' | 'pending' | 'not_applicable' | 'unknown';

export interface Stage {
  id: StageId;
  state: StageState;
  /** When the evidence happened, if any. */
  at: ISODate | null;
  /** Short explanation of the evidence or of what is missing. */
  note: string;
}

export type DeliveryStatus =
  | 'draft'
  | 'awaiting_review'
  | 'changes_requested'
  | 'ci_failed'
  | 'approved'
  | 'merged'
  | 'in_staging'
  | 'in_production'
  | 'closed';

/** Latest verdict per reviewer (ignores plain comments). */
function latestVerdicts(reviews: Review[]): Review[] {
  const latest = new Map<string, Review>();
  for (const r of [...reviews].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))) {
    if (r.verdict !== 'commented') latest.set(r.reviewerId, r);
  }
  return [...latest.values()];
}

function earliest(dates: ISODate[]): ISODate | null {
  return dates.length ? [...dates].sort()[0] : null;
}

const successful = (deps: Deployment[], env?: Deployment['environment']) =>
  deps.filter((d) => d.status === 'success' && (!env || d.environment === env));

export function isApproved(reviews: Review[]): boolean {
  const verdicts = latestVerdicts(reviews);
  return verdicts.some((r) => r.verdict === 'approved') && !verdicts.some((r) => r.verdict === 'changes_requested');
}

export function hasChangesRequested(reviews: Review[]): boolean {
  return latestVerdicts(reviews).some((r) => r.verdict === 'changes_requested');
}

/** CI is failing when the most recent run on the head failed. */
export function isCiFailing(headRuns: PipelineRun[]): boolean {
  const latest = [...headRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return latest?.status === 'failure';
}

export function deliveryStatus(e: ChangeRequestEvidence): DeliveryStatus {
  const cr = e.changeRequest;
  if (cr.state === 'closed') return 'closed';
  if (cr.state === 'merged') {
    if (successful(e.deployments, 'production').length) return 'in_production';
    if (successful(e.deployments, 'staging').length) return 'in_staging';
    return 'merged';
  }
  if (cr.draft) return 'draft';
  if (isCiFailing(e.headRuns)) return 'ci_failed';
  if (hasChangesRequested(e.reviews)) return 'changes_requested';
  if (isApproved(e.reviews)) return 'approved';
  return 'awaiting_review';
}

export function timeline(e: ChangeRequestEvidence): Stage[] {
  const cr = e.changeRequest;
  const closedUnmerged = cr.state === 'closed';
  const firstReviewAt = earliest(e.reviews.map((r) => r.submittedAt));
  const approvals = e.reviews.filter((r) => r.verdict === 'approved');
  const approved = isApproved(e.reviews);
  const anyDeploy = successful(e.deployments);
  const prodDeploy = successful(e.deployments, 'production');

  const pendingOrNA = (note: string): Pick<Stage, 'state' | 'note'> =>
    closedUnmerged ? { state: 'not_applicable', note: 'Fechado sem integração.' } : { state: 'pending', note };
  const unknown = (id: StageId, note: string): Stage => ({ id, state: 'unknown', at: null, note });
  const knowsReviews = e.capabilities.reviews !== 'unavailable';
  const knowsDeployments = e.capabilities.deployments !== 'unavailable';

  const inReview: Stage = !knowsReviews
    ? unknown('in_review', 'A fonte de dados não informa revisões.')
    : firstReviewAt
    ? { id: 'in_review', state: 'done', at: firstReviewAt, note: `${e.reviews.length} revisão(ões) registrada(s).` }
    : cr.requestedReviewerIds.length
      ? { id: 'in_review', state: 'pending', at: null, note: 'Revisão solicitada, nenhuma resposta ainda.' }
      : { id: 'in_review', at: null, ...pendingOrNA('Nenhuma revisão solicitada.') };

  const approvedStage: Stage = !knowsReviews
    ? unknown('approved', 'A fonte de dados não informa aprovações.')
    : approved
    ? { id: 'approved', state: 'done', at: earliest(approvals.map((r) => r.submittedAt)), note: 'Aprovação registrada.' }
    : hasChangesRequested(e.reviews)
      ? { id: 'approved', state: 'blocked', at: null, note: 'Alterações solicitadas pela revisão.' }
      : { id: 'approved', at: null, ...pendingOrNA('Sem aprovação registrada.') };

  const mergedStage: Stage = cr.mergedAt
    ? { id: 'merged', state: 'done', at: cr.mergedAt, note: `Integrado em ${cr.targetBranch}.` }
    : isCiFailing(e.headRuns)
      ? { id: 'merged', state: 'blocked', at: null, note: 'Pipeline falhando na última versão.' }
      : { id: 'merged', at: null, ...pendingOrNA('Ainda não integrado.') };

  const deployedStage: Stage = !knowsDeployments
    ? unknown('deployed', 'A fonte de dados não informa deploys.')
    : anyDeploy.length
    ? {
        id: 'deployed',
        state: 'done',
        at: earliest(anyDeploy.map((d) => d.createdAt)),
        note: `Deploy em ${[...new Set(anyDeploy.map((d) => d.environment))].join(', ')}.`,
      }
    : { id: 'deployed', at: null, ...pendingOrNA('Nenhum deploy contendo esta mudança foi encontrado.') };

  const productionStage: Stage = !knowsDeployments
    ? unknown('production', 'Sem dados de deploy: não é possível confirmar produção.')
    : prodDeploy.length
    ? { id: 'production', state: 'done', at: earliest(prodDeploy.map((d) => d.createdAt)), note: 'Deploy em produção com sucesso.' }
    : e.deployments.some((d) => d.environment === 'production' && d.status === 'failure')
      ? { id: 'production', state: 'blocked', at: null, note: 'Deploy em produção falhou.' }
      : { id: 'production', at: null, ...pendingOrNA('Sem evidência de produção.') };

  return [
    {
      id: 'opened',
      state: 'done',
      at: cr.createdAt,
      note: cr.origin === 'merge-commit' ? 'Inferido do histórico Git (primeiro commit).' : cr.draft ? 'Aberto como rascunho.' : 'Aberto.',
    },
    inReview,
    approvedStage,
    mergedStage,
    deployedStage,
    productionStage,
  ];
}
