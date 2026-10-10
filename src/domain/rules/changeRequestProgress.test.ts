import { describe, expect, it } from 'vitest';
import type { ChangeRequest, Deployment, PipelineRun, Review } from '@domain/entities';
import {
  deliveryStatus,
  timeline,
  type ChangeRequestEvidence,
  type DeliveryStatus,
  type StageId,
  type StageState,
} from './changeRequestProgress';

const T = (day: number) => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;

const cr = (o: Partial<ChangeRequest> = {}): ChangeRequest => ({
  id: 'cr-1',
  evidence: 'provider',
  number: 1,
  repositoryId: 'repo-1',
  title: 't',
  productSummary: null,
  authorId: 'ct-a',
  state: 'open',
  draft: false,
  createdAt: T(1),
  mergedAt: null,
  closedAt: null,
  headSha: 'head',
  mergeCommitSha: null,
  targetBranch: 'main',
  requestedReviewerIds: [],
  initiativeId: null,
  webUrl: 'https://x.invalid/1',
  ...o,
});
const review = (reviewerId: string, verdict: Review['verdict'], day: number): Review => ({
  id: `rv-${reviewerId}-${day}`,
  changeRequestId: 'cr-1',
  reviewerId,
  verdict,
  submittedAt: T(day),
});
const run = (status: PipelineRun['status'], day: number): PipelineRun => ({
  id: `run-${day}`,
  repositoryId: 'repo-1',
  pipelineName: 'ci',
  headSha: 'head',
  branch: 'b',
  changeRequestId: 'cr-1',
  status,
  startedAt: T(day),
  webUrl: 'https://x.invalid/run',
});
const deploy = (environment: Deployment['environment'], status: Deployment['status'], day: number): Deployment => ({
  id: `dep-${environment}-${status}-${day}`,
  repositoryId: 'repo-1',
  environment,
  sha: 's',
  ref: 'main',
  createdAt: T(day),
  status,
  changeRequestIds: ['cr-1'],
  webUrl: 'https://x.invalid/dep',
});
const evidence = (o: Partial<ChangeRequestEvidence> = {}): ChangeRequestEvidence => ({
  changeRequest: cr(),
  reviews: [],
  headRuns: [],
  deployments: [],
  ...o,
});
const merged = (deployments: Deployment[] = []) =>
  evidence({ changeRequest: cr({ state: 'merged', mergedAt: T(5) }), deployments });
const stateOf = (e: ChangeRequestEvidence, id: StageId): StageState => timeline(e).find((s) => s.id === id)!.state;

describe('deliveryStatus', () => {
  const cases: Array<[DeliveryStatus, ChangeRequestEvidence]> = [
    ['draft', evidence({ changeRequest: cr({ draft: true }) })],
    ['awaiting_review', evidence()],
    ['changes_requested', evidence({ reviews: [review('r', 'changes_requested', 2)] })],
    ['ci_failed', evidence({ headRuns: [run('failure', 2)] })],
    ['approved', evidence({ reviews: [review('r', 'approved', 2)] })],
    ['merged', merged()],
    ['in_staging', merged([deploy('staging', 'success', 6)])],
    ['in_production', merged([deploy('production', 'success', 7)])],
    ['closed', evidence({ changeRequest: cr({ state: 'closed', closedAt: T(3) }) })],
  ];
  it.each(cases)('%s', (expected, e) => {
    expect(deliveryStatus(e)).toBe(expected);
  });

  it('merged is not in_production without deployments', () => {
    expect(deliveryStatus(merged())).toBe('merged');
  });

  it('failed or running deployments never count', () => {
    const deployments = [
      deploy('production', 'failure', 6),
      deploy('production', 'running', 7),
      deploy('staging', 'failure', 6),
      deploy('staging', 'running', 7),
    ];
    expect(deliveryStatus(merged(deployments))).toBe('merged');
  });

  it('staging success plus failed production stays in_staging', () => {
    expect(deliveryStatus(merged([deploy('staging', 'success', 6), deploy('production', 'failure', 7)]))).toBe('in_staging');
  });

  it('latest verdict per reviewer wins', () => {
    const e = evidence({ reviews: [review('r', 'changes_requested', 2), review('r', 'approved', 3)] });
    expect(deliveryStatus(e)).toBe('approved');
  });

  it('a later changes_requested overrides an earlier approval', () => {
    const e = evidence({ reviews: [review('r', 'approved', 2), review('r', 'changes_requested', 3)] });
    expect(deliveryStatus(e)).toBe('changes_requested');
  });

  it('a plain comment does not override a verdict', () => {
    const e = evidence({ reviews: [review('r', 'approved', 2), review('r', 'commented', 3)] });
    expect(deliveryStatus(e)).toBe('approved');
  });

  it('only comments leave the change awaiting review', () => {
    expect(deliveryStatus(evidence({ reviews: [review('r', 'commented', 2)] }))).toBe('awaiting_review');
  });

  it('only the most recent head run decides CI', () => {
    const e = evidence({ headRuns: [run('failure', 2), run('success', 3)] });
    expect(deliveryStatus(e)).toBe('awaiting_review');
  });
});

describe('timeline', () => {
  it('merged CR without deployments has deployed and production pending', () => {
    const e = merged();
    expect(stateOf(e, 'merged')).toBe('done');
    expect(stateOf(e, 'deployed')).toBe('pending');
    expect(stateOf(e, 'production')).toBe('pending');
  });

  it('never marks stages done without evidence', () => {
    const states = timeline(evidence()).map((s) => [s.id, s.state]);
    expect(states).toEqual([
      ['opened', 'done'],
      ['in_review', 'pending'],
      ['approved', 'pending'],
      ['merged', 'pending'],
      ['deployed', 'pending'],
      ['production', 'pending'],
    ]);
  });

  it('staging success marks deployed but not production', () => {
    const e = merged([deploy('staging', 'success', 6)]);
    expect(stateOf(e, 'deployed')).toBe('done');
    expect(stateOf(e, 'production')).toBe('pending');
  });

  it('failed and running deployments do not mark deployed', () => {
    const e = merged([deploy('staging', 'failure', 6), deploy('production', 'running', 7)]);
    expect(stateOf(e, 'deployed')).toBe('pending');
    expect(stateOf(e, 'production')).toBe('pending');
  });

  it('failed production deploy blocks the production stage', () => {
    expect(stateOf(merged([deploy('production', 'failure', 6)]), 'production')).toBe('blocked');
  });

  it('production success marks deployed and production done with evidence dates', () => {
    const stages = timeline(merged([deploy('production', 'success', 7)]));
    const production = stages.find((s) => s.id === 'production')!;
    expect(production.state).toBe('done');
    expect(production.at).toBe(T(7));
  });

  it('closed CR makes later stages not_applicable', () => {
    const e = evidence({ changeRequest: cr({ state: 'closed', closedAt: T(3) }) });
    for (const id of ['in_review', 'approved', 'merged', 'deployed', 'production'] as const) {
      expect(stateOf(e, id)).toBe('not_applicable');
    }
    expect(stateOf(e, 'opened')).toBe('done');
  });

  it('requested reviewers without answers keep in_review pending', () => {
    const e = evidence({ changeRequest: cr({ requestedReviewerIds: ['r'] }) });
    expect(stateOf(e, 'in_review')).toBe('pending');
  });

  it('changes_requested blocks the approved stage', () => {
    const e = evidence({ reviews: [review('r', 'changes_requested', 2)] });
    expect(stateOf(e, 'in_review')).toBe('done');
    expect(stateOf(e, 'approved')).toBe('blocked');
  });

  it('failing head CI on an open CR blocks the merged stage', () => {
    expect(stateOf(evidence({ headRuns: [run('failure', 2)] }), 'merged')).toBe('blocked');
  });

  it('recovered CI no longer blocks merged', () => {
    expect(stateOf(evidence({ headRuns: [run('failure', 2), run('success', 3)] }), 'merged')).toBe('pending');
  });

  it('approval after changes requested by the same reviewer marks approved done', () => {
    const e = evidence({ reviews: [review('r', 'changes_requested', 2), review('r', 'approved', 3)] });
    expect(stateOf(e, 'approved')).toBe('done');
  });
});
