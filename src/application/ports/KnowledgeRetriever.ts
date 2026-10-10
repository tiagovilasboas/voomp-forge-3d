import type { ID } from '@domain/entities';

/**
 * Retrieval over the knowledge base (Confluence, Notion, docs in repos…).
 *
 * Today: a local keyword retriever over document metadata.
 * Later (RAG): an embeddings index served by the Forge backend — content stays
 * inside company infrastructure and is never sent to external models without
 * explicit authorisation.
 */
export interface KnowledgePassage {
  documentId: ID;
  /** Short excerpt or title that matched. */
  text: string;
  score: number;
}

export interface KnowledgeRetriever {
  readonly mode: 'keyword' | 'semantic';
  search(query: string, options?: { limit?: number; initiativeId?: ID; repositoryId?: ID }): Promise<KnowledgePassage[]>;
}
