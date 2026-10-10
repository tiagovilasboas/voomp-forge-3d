import type { StatusGroup } from '@application/queries/deliveries';
import type { StageId } from '@domain/rules/changeRequestProgress';
import type { DeploymentEnvironment } from '@domain/entities';

export const STAGE_LABEL: Record<StageId, string> = {
  opened: 'Aberto',
  in_review: 'Em revisão',
  approved: 'Aprovado',
  merged: 'Integrado',
  deployed: 'Deploy',
  production: 'Produção',
};

export const STATUS_GROUP_LABEL: Record<StatusGroup, string> = {
  production: 'Em produção',
  staging: 'Em staging',
  integrated: 'Integrado, sem deploy',
  review: 'Em revisão',
  blocked: 'Bloqueado',
  draft: 'Rascunho',
  closed: 'Fechado',
};

export const STATUS_GROUP_ORDER: StatusGroup[] = ['production', 'staging', 'integrated', 'review', 'blocked', 'draft', 'closed'];

export const ENVIRONMENT_LABEL: Record<DeploymentEnvironment, string> = {
  staging: 'Staging',
  production: 'Produção',
};

export const NO_INITIATIVE = 'Iniciativa não identificada';
export const NO_PRODUCT_SUMMARY = 'Sem resumo para Produto';
