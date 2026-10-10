import type { DeliveryStatus } from '@domain/rules/changeRequestProgress';
import type { Signal } from '@application/queries/repositoryHealth';

/** Brand palette shared by the 3D scene (hex) and the HUD (Tailwind tokens mirror these). */
export const PALETTE = {
  ink950: '#090B10',
  ink900: '#13161C',
  ink700: '#242932',
  forge: '#FF6A00',
  forgeBright: '#FF8C32',
  snow: '#F5F5F5',
  fog: '#9DA3AE',
  ok: '#34C88A',
  fail: '#EF5350',
  warn: '#F6B94D',
  idle: '#6B7280',
  unknown: '#8B8FB8',
} as const;

export type IconName =
  | 'pulse' | 'check' | 'clock' | 'alert' | 'moon' | 'help' | 'merge' | 'rocket' | 'flask' | 'eye'
  | 'draft' | 'x' | 'branch' | 'pipeline' | 'commit' | 'squad' | 'rack' | 'person' | 'target' | 'search'
  | 'gear' | 'table' | 'compass' | 'home' | 'plus' | 'minus' | 'rotate' | 'bell' | 'external' | 'chevron' | 'close' | 'play' | 'github' | 'heart';

export interface Look {
  label: string;
  icon: IconName;
  color: string;
  /** Tailwind text colour class. */
  text: string;
}

/** One visual language for repository/module signals. Never colour alone: always label + icon. */
export const SIGNAL_LOOK: Record<Signal, Look> = {
  active: { label: 'Atividade recente', icon: 'pulse', color: PALETTE.forge, text: 'text-forge-bright' },
  success: { label: 'Sucesso confirmado', icon: 'check', color: PALETTE.ok, text: 'text-ok' },
  attention: { label: 'Atenção', icon: 'clock', color: PALETTE.warn, text: 'text-warn' },
  error: { label: 'Erro ou bloqueio', icon: 'alert', color: PALETTE.fail, text: 'text-fail' },
  idle: { label: 'Sem atividade recente', icon: 'moon', color: PALETTE.idle, text: 'text-idle' },
  unknown: { label: 'Sem dados', icon: 'help', color: PALETTE.unknown, text: 'text-unknown' },
};

export const STATUS_LOOK: Record<DeliveryStatus, Look> = {
  in_production: { label: 'Em produção', icon: 'rocket', color: PALETTE.ok, text: 'text-ok' },
  in_staging: { label: 'Em staging', icon: 'flask', color: PALETTE.warn, text: 'text-warn' },
  merged: { label: 'Integrado · sem deploy', icon: 'merge', color: PALETTE.forgeBright, text: 'text-forge-bright' },
  approved: { label: 'Aprovado', icon: 'check', color: PALETTE.forgeBright, text: 'text-forge-bright' },
  awaiting_review: { label: 'Aguardando revisão', icon: 'eye', color: PALETTE.warn, text: 'text-warn' },
  changes_requested: { label: 'Ajustes solicitados', icon: 'alert', color: PALETTE.fail, text: 'text-fail' },
  ci_failed: { label: 'Pipeline falhou', icon: 'alert', color: PALETTE.fail, text: 'text-fail' },
  draft: { label: 'Rascunho', icon: 'draft', color: PALETTE.idle, text: 'text-idle' },
  closed: { label: 'Fechado sem integrar', icon: 'x', color: PALETTE.idle, text: 'text-idle' },
};
