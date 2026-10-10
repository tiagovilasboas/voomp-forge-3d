import type { Connector, ConnectorFactory } from '@application/ports/connectors';
import { ConfluenceConnector, type ConfluenceConfig } from './confluence';
import { GitLocalConnector, type GitLocalConfig, type RunGit } from './gitLocal';
import { defaultFetchJson, type FetchJson } from './http';
import { JiraConnector, type JiraConfig } from './jira';
import { PlanCsvConnector, type PlanCsvConfig, type ReadTextFile } from './planCsv';

/** IO the connectors need; injected by the CLI (real) or tests (fakes). */
export interface ConnectorDeps {
  runGit: RunGit;
  fetchJson?: FetchJson;
  readText: ReadTextFile;
  /** Resolves relative repository paths (git-local). */
  resolvePath?: (path: string) => string;
}

export type ConnectorRegistry = Record<string, ConnectorFactory>;

export function createRegistry(deps: ConnectorDeps): ConnectorRegistry {
  const fetchJson = deps.fetchJson ?? defaultFetchJson;
  return {
    'git-local': (c) => new GitLocalConnector(c as GitLocalConfig, deps.runGit, deps.resolvePath),
    jira: (c) => new JiraConnector(c as JiraConfig, fetchJson),
    'plan-csv': (c) => new PlanCsvConnector(c as PlanCsvConfig, deps.readText),
    confluence: (c) => new ConfluenceConnector(c as ConfluenceConfig, fetchJson),
  };
}

/** Builds connectors from `forge.config` blocks (`{ type, ...config }`). */
export function buildConnectors(blocks: { type: string }[], registry: ConnectorRegistry): Connector[] {
  return blocks.map((block) => {
    const factory = registry[block.type];
    if (!factory) throw new Error(`Conector desconhecido: "${block.type}". Disponíveis: ${Object.keys(registry).join(', ')}.`);
    return factory(block);
  });
}
