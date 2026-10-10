import type {
  ChangeRequest,
  Commit,
  Contributor,
  Deployment,
  ForgeSnapshot,
  KnowledgeDocument,
  Organization,
  PipelineRun,
  ProductInitiative,
  ProviderInfo,
  Repository,
  Review,
  SourceCapabilities,
  Squad,
  WorkItem,
  Workstream,
} from '@domain/entities';

/**
 * Plug-and-play ingestion. Every external system (Git hosts, Jira/Linear,
 * Confluence/Notion, the planning sheet, CD tools…) is a connector that
 * contributes a fragment of the snapshot. Fragments are merged into one
 * `ForgeSnapshot`; the UI never knows which connectors were used.
 *
 * Connectors run where credentials live (CLI or backend) — never in the browser.
 */

export type ConnectorKind = 'vcs' | 'tracker' | 'plan' | 'knowledge' | 'deploy' | 'ci';

/** Only what a connector knows; everything is optional. */
export interface SnapshotFragment {
  organization?: Organization;
  provider?: ProviderInfo;
  /** Capabilities this fragment provides (merged: best level wins). */
  capabilities?: Partial<SourceCapabilities>;
  squads?: Squad[];
  repositories?: Repository[];
  contributors?: Contributor[];
  changeRequests?: ChangeRequest[];
  reviews?: Review[];
  commits?: Commit[];
  pipelineRuns?: PipelineRun[];
  deployments?: Deployment[];
  initiatives?: ProductInitiative[];
  documents?: KnowledgeDocument[];
  workItems?: WorkItem[];
  workstreams?: Workstream[];
}

export interface ConnectorContext {
  now: Date;
  /** Only look at activity since this date. */
  since: Date;
  /** Read a secret by name (env var, vault…). Connectors never log secrets. */
  secret(name: string): string | undefined;
  log(message: string): void;
}

export interface Connector<TConfig = unknown> {
  /** Registry key used in forge.config, e.g. "git-local", "jira", "confluence", "plan-csv". */
  readonly type: string;
  readonly kind: ConnectorKind;
  readonly config: TConfig;
  collect(ctx: ConnectorContext): Promise<SnapshotFragment>;
}

/** Builds a connector from its config block. Registered once per connector type. */
export type ConnectorFactory = (config: unknown) => Connector;

/** Turns fragments into a validated-shape snapshot (see application/contracts/mergeFragments). */
export type FragmentMerger = (fragments: SnapshotFragment[], now: Date) => ForgeSnapshot;
