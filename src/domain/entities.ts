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
  documents: CapabilityLevel;
  /** Tracker issues (Jira, Linear, Git issues…). */
  workItems: CapabilityLevel;
  /** Delivery fronts (planning sheet / config). */
  workstreams: CapabilityLevel;
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

/**
 * Reference to a task in any tracker (Jira, Linear, GitHub/GitLab issues…),
 * extracted from the change request title, branch or description by a
 * configured pattern. Never guessed.
 */
export interface WorkItemRef {
  key: string;
  url: string | null;
}

/** Where a change request comes from: the provider, or inferred from a merge/squash commit. */
export type ChangeRequestOrigin = 'provider' | 'merge-commit';

export interface ChangeRequest {
  id: ID;
  origin: ChangeRequestOrigin;
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
  /** Tasks this change refers to. Empty = none referenced. */
  workItems: WorkItemRef[];
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

export type DocumentKind = 'spec' | 'adr' | 'runbook' | 'postmortem' | 'guide';

/**
 * A page of the company knowledge base — Confluence, Notion, Google Docs or
 * Markdown inside a repository. Links to initiatives and repositories are
 * explicit (labels, page properties, front matter), never inferred from text.
 */
export interface KnowledgeDocument {
  id: ID;
  title: string;
  kind: DocumentKind;
  /** Space / folder / wiki section, e.g. "ENG", "Produto". */
  space: string;
  squadId: ID | null;
  initiativeIds: ID[];
  repositoryIds: ID[];
  updatedAt: ISODate;
  webUrl: string;
}

export type WorkItemType = 'epic' | 'story' | 'task' | 'bug';
/** Normalised status category; the tracker's own name is kept in `statusName`. */
export type WorkItemStatus = 'todo' | 'in_progress' | 'done';

/** A tracker issue (Jira, Linear, GitHub/GitLab issue…). Keys match `WorkItemRef.key`. */
export interface WorkItem {
  key: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  statusName: string;
  /** Parent epic key, when the tracker has one. */
  epicKey: string | null;
  sprint: string | null;
  updatedAt: ISODate;
  /**
   * Production evidence from the tracker itself (a status mapped as "in
   * production", or a released fix version). Null = the tracker does not say so.
   */
  productionAt: ISODate | null;
  url: string | null;
}

/** How the planning sheet groups fronts. */
export type WorkstreamCategory = 'sprint_priority' | 'closing' | 'sustaining' | 'open_topic';
export type StaffRole = 'tl' | 'dev' | 'qa' | 'pm' | 'n2';

export interface StaffAssignment {
  role: StaffRole;
  /** Linked contributor when known; planning sheets often only have a display name. */
  personId: ID | null;
  displayName: string;
  /** e.g. "front", "back", "fullstack", "apoio". */
  specialty: string | null;
}

export interface PlannedDelivery {
  /** As written by the team: "MVP Semana 2 - quinta (10)", "Sob demanda"… */
  label: string;
  /** Parsed target date when there is one. Null = no committed date (e.g. on demand). */
  target: ISODate | null;
  /** When this plan was recorded. */
  recordedAt: ISODate;
}

export interface WorkstreamDependency {
  description: string;
  /** blocker = work cannot proceed; waiting = waiting on someone else's answer or delivery. */
  kind: 'blocker' | 'waiting';
}

/**
 * Frente: a delivery workstream as planned by the team (typically a column of
 * the planning sheet), linked to tracker epics and to initiatives so its
 * progress can be checked against Git evidence.
 *
 * A front is NOT a squad: a squad works on many fronts, and a front may involve
 * several squads. Its team is per-front (the same person may be TL here and DEV
 * elsewhere).
 */
export interface Workstream {
  id: ID;
  name: string;
  category: WorkstreamCategory;
  /** Squads involved (many-to-many). Empty = not identified. */
  squadIds: ID[];
  initiativeId: ID | null;
  /** Repositories touched by this front, when declared. */
  repositoryIds: ID[];
  /** Tracker epics whose issues belong to this front. */
  epicKeys: string[];
  team: StaffAssignment[];
  /** Plan history, oldest first; the last entry is the current plan. */
  plans: PlannedDelivery[];
  dependencies: WorkstreamDependency[];
  /** What the sheet declares ("Finalizado", "Entregue"). Never trusted alone. */
  declaredDone: boolean;
  links: { label: string; url: string }[];
  notes: string[];
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
  documents: KnowledgeDocument[];
  workItems: WorkItem[];
  workstreams: Workstream[];
}
