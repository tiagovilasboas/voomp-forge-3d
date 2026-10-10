import type { DocumentKind } from '@domain/entities';

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  spec: 'Especificação',
  adr: 'ADR',
  runbook: 'Runbook',
  postmortem: 'Post-mortem',
  guide: 'Guia',
};
