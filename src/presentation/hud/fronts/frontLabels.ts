import type { StaffRole, WorkstreamCategory, ISODate } from '@domain/entities';
import type { WorkstreamStatus } from '@domain/rules/workstreamProgress';
import type { WorkstreamView } from '@application/queries/workstreams';
import { PALETTE, type Look } from '../../theme';

/** Status of a front: always icon + text + colour. */
export const WS_STATUS_LOOK: Record<WorkstreamStatus, Look> = {
  delivered: { label: 'Entregue', icon: 'check', color: PALETTE.ok, text: 'text-ok' },
  blocked: { label: 'Bloqueada', icon: 'alert', color: PALETTE.fail, text: 'text-fail' },
  at_risk: { label: 'Em risco', icon: 'clock', color: PALETTE.warn, text: 'text-warn' },
  in_progress: { label: 'Em andamento', icon: 'pulse', color: PALETTE.forgeBright, text: 'text-forge-bright' },
  planned: { label: 'Planejada', icon: 'draft', color: PALETTE.idle, text: 'text-idle' },
  on_demand: { label: 'Sob demanda', icon: 'gear', color: PALETTE.idle, text: 'text-idle' },
};

export const WS_STATUS_ORDER: WorkstreamStatus[] = ['blocked', 'at_risk', 'in_progress', 'planned', 'on_demand', 'delivered'];

export const CATEGORY_LABEL: Record<WorkstreamCategory, string> = {
  sprint_priority: 'Prioridades da sprint',
  closing: 'Fechamentos',
  sustaining: 'Plantão',
  open_topic: 'Temas abertos',
};
export const CATEGORY_ORDER: WorkstreamCategory[] = ['sprint_priority', 'closing', 'sustaining', 'open_topic'];

export const ROLE_LABEL: Record<StaffRole, string> = { tl: 'TL', dev: 'DEV', qa: 'QA', pm: 'PM', n2: 'N2' };
export const ROLE_ORDER: StaffRole[] = ['tl', 'dev', 'qa', 'pm', 'n2'];

/** "2026-10-08T…" -> "08/10". Uses the date part as written, so a target never shifts with the time zone. */
export function shortDate(iso: ISODate | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

export const dateOnly = (iso: ISODate) => iso.slice(0, 10);

function list(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

export const evidenceText = (ev: ('tracker' | 'git')[]) => list(ev.map((e) => (e === 'tracker' ? 'Jira' : 'Git')));

/** One plain-language sentence a PM can read out loud. */
export function summarize(v: WorkstreamView): string {
  const p = v.progress;
  const parts: string[] = [];
  const replanned = p.replans > 0 ? `replanejada ${p.replans}x` : '';
  switch (p.status) {
    case 'delivered': {
      const prazo = p.onTime === true ? ', dentro do prazo' : p.onTime === false ? `, depois do prazo (${shortDate(p.target)})` : '';
      parts.push(`Entregue em produção em ${shortDate(p.deliveredAt)} (evidência: ${evidenceText(p.evidence)})${prazo}.`);
      break;
    }
    case 'blocked': {
      const why = p.blockers.length ? p.blockers.join('; ') : 'há mudanças vinculadas com falha ou ajustes pendentes';
      parts.push(`Bloqueada: ${why}.${replanned ? ` ${cap(replanned)}.` : ''}`);
      break;
    }
    case 'at_risk': {
      const extra = [replanned, p.waitingOn.length ? `aguardando ${p.waitingOn.join('; ')}` : ''].filter(Boolean).join('; ');
      parts.push(`Em risco: prazo ${shortDate(p.target)} passou${extra ? `, ${extra}` : ''}.`);
      break;
    }
    case 'in_progress': {
      const items = p.items.total ? `${p.items.done} de ${p.items.total} issues concluídas no Jira` : 'trabalho em curso';
      parts.push(`Em andamento: ${items}${p.target ? `; meta ${shortDate(p.target)}` : ''}${replanned ? `; ${replanned}` : ''}.`);
      break;
    }
    case 'planned':
      parts.push(`Planejada${p.target ? ` para ${shortDate(p.target)}` : ''}; ainda sem movimento no Jira ou no Git.`);
      break;
    case 'on_demand':
      parts.push('Plantão sob demanda, sem data comprometida.');
      break;
  }
  if (p.status !== 'at_risk' && p.status !== 'blocked' && p.waitingOn.length) parts.push(`Aguardando ${p.waitingOn.join('; ')}.`);
  if (p.divergence) parts.push('Atenção: Jira e Git não concordam.');
  if (p.declaredWithoutEvidence) parts.push('A planilha diz que está entregue, mas não há evidência em produção.');
  return parts.join(' ');
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
