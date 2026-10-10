/**
 * Voomp Forge domain entities — provider agnostic.
 *
 * Vocabulary is deliberately neutral so any Git platform maps onto it:
 *   ChangeRequest = GitHub/Bitbucket pull request, GitLab merge request, Azure PR…
 *   PipelineRun   = GitHub Actions run, GitLab pipeline, Jenkins build…
 * Providers only contribute display vocabulary (see `ProviderInfo`).
 *
 * This layer has no dependencies. Dates are ISO-8601 strings.
 */

export type ISODate = string;
export type ID = string;

export interface ProviderVocabulary {
  /** e.g. "Pull request", "Merge request" */
  changeRequest: string;
  /** e.g. "PR", "MR" */
  changeRequestShort: string;
  /** e.g. "Workflow", "Pipeline" */
  pipeline: string;
}

export interface ProviderInfo {
  /** Free-form id: "github", "gitlab", "bitbucket", "demo"… */
  id: string;
  name: string;
  vocabulary: ProviderVocabulary;
}

/** demo = fictional data; imported = snapshot file (e.g. from forge-ingest); connected = Forge backend. */
export type SourceKind = 'demo' | 'imported' | 'connected';

/**
 * What a source is able to know. The UI must tell "zero" apart from "unknown":
 * a repository whose source has no pipeline data shows "sem dados", never "0 falhas".
 *  native      = read from the provider (PRs/MRs, reviews, CI runs, deployments)
 *  inferred    = derived from plain Git history (e.g. merge commit messages, tags)
 *  unavailable = the source cannot know it
 */
export type CapabilityLevel = 'native' | 'inferred' | 'unavailable';

export interface SourceCapabilities {
  changeRequests: CapabilityLevel;
  reviews: CapabilityLevel;
  pipelines: CapabilityLevel;
  deployments: CapabilityLevel;
}

/** Bumped on breaking changes of the snapshot contract. */
export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface Organization {
  id: ID;
  name: string;
  slug: string;
}

export interface Squad {
  id: ID;
  /** Short sector code shown on the floor ("A", "B"…). */
  code: string;
  name: string;
  description: string;
}

export interface Repository {
  id: ID;
  squadId: ID;
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  language: string;
  webUrl: string;
}

/** Only set when the source explicitly authorises it. Never inferred from activity. */
export type ContributorRole = 'developer' | 'reviewer' | 'tech-lead' | 'product-manager';

export interface Contributor {
  id: ID;
  displayName: string;
  handle: string;
  squadId: ID;
  role: ContributorRole | null;
}

export type ChangeRequestState = 'open' | 'closed' | 'merged';

/** How a change request is known: from the provider, or inferred from a merge/squash commit. */
export type ChangeRequestEvidence = 'provider' | 'merge-commit';

export interface ChangeRequest {
  id: ID;
  evidence: ChangeRequestEvidence;
  number: number;
  repositoryId: ID;
  title: string;
  /** Plain-language summary for Product. Null when nobody wrote one. */
  productSummary: string | null;
  authorId: ID;
  state: ChangeRequestState;
  draft: boolean;
  createdAt: ISODate;
  mergedAt: ISODate | null;
  closedAt: ISODate | null;
  headSha: string;
  mergeCommitSha: string | null;
  targetBranch: string;
  requestedReviewerIds: ID[];
  /** Explicit link to an initiative. Null = not identified (never guessed). */
  initiativeId: ID | null;
  webUrl: string;
}

export type ReviewVerdict = 'approved' | 'changes_requested' | 'commented';

export interface Review {
  id: ID;
  changeRequestId: ID;
  reviewerId: ID;
  verdict: ReviewVerdict;
  submittedAt: ISODate;
}

export interface Commit {
  sha: string;
  repositoryId: ID;
  authorId: ID;
  message: string;
  committedAt: ISODate;
  changeRequestId: ID | null;
  webUrl: string;
}

export type PipelineStatus = 'running' | 'success' | 'failure' | 'cancelled';

export interface PipelineRun {
  id: ID;
  repositoryId: ID;
  pipelineName: string;
  headSha: string;
  branch: string;
  changeRequestId: ID | null;
  status: PipelineStatus;
  startedAt: ISODate;
  webUrl: string;
}

export type DeploymentEnvironment = 'staging' | 'production';
export type DeploymentStatus = 'running' | 'success' | 'failure';

export interface Deployment {
  id: ID;
  repositoryId: ID;
  environment: DeploymentEnvironment;
  sha: string;
  ref: string;
  createdAt: ISODate;
  status: DeploymentStatus;
  /** Change requests proven to be contained in `sha` — the only evidence link used. */
  changeRequestIds: ID[];
  webUrl: string;
}

export type InitiativeStatus = 'discovery' | 'in_delivery' | 'released';

export interface ProductInitiative {
  id: ID;
  key: string;
  name: string;
  summary: string;
  ownerSquadId: ID;
  status: InitiativeStatus;
}

/** A complete, normalised picture returned by any data source. */
export interface ForgeSnapshot {
  schemaVersion: number;
  source: { kind: SourceKind; provider: ProviderInfo; capabilities: SourceCapabilities; generatedAt: ISODate };
  organization: Organization;
  squads: Squad[];
  repositories: Repository[];
  contributors: Contributor[];
  changeRequests: ChangeRequest[];
  reviews: Review[];
  commits: Commit[];
  pipelineRuns: PipelineRun[];
  deployments: Deployment[];
  initiatives: ProductInitiative[];
}
