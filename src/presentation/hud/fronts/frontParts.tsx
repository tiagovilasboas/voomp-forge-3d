import type { ReactNode } from 'react';
import type { StaffRole, Workstream } from '@domain/entities';
import type { WorkstreamStatus } from '@domain/rules/workstreamProgress';
import type { WorkstreamView } from '@application/queries/workstreams';
import { Icon } from '../kit/Icon';
import { StatusBadge } from '../kit/primitives';
import { EvidenceLink } from '../kit/EvidenceLink';
import { ROLE_LABEL, ROLE_ORDER, WS_STATUS_LOOK, shortDate } from './frontLabels';

export function WsStatusBadge({ status }: { status: WorkstreamStatus }) {
  return <StatusBadge look={WS_STATUS_LOOK[status]} />;
}

export function Flag({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded-md bg-warn/15 px-1.5 py-0.5 text-[11px] font-semibold text-warn">
      <Icon name="alert" size={12} />
      {children}
    </span>
  );
}

export function EvidenceChips({ view }: { view: WorkstreamView }) {
  const ev = view.progress.evidence;
  if (view.progress.status !== 'delivered' || ev.length === 0) return null;
  return (
    <>
      {ev.includes('tracker') && (
        <span className="inline-flex items-center gap-1 rounded-md bg-ok/15 px-1.5 py-0.5 text-[11px] font-semibold text-ok" title="Produção confirmada no Jira">
          <Icon name="check" size={11} />
          Jira
        </span>
      )}
      {ev.includes('git') && (
        <span className="inline-flex items-center gap-1 rounded-md bg-ok/15 px-1.5 py-0.5 text-[11px] font-semibold text-ok" title="Produção confirmada por deploy no Git">
          <Icon name="check" size={11} />
          Git
        </span>
      )}
    </>
  );
}

export function FlagRow({ view }: { view: WorkstreamView }) {
  const p = view.progress;
  if (!p.divergence && !p.declaredWithoutEvidence) return null;
  return (
    <>
      {p.divergence && <Flag title="O Jira e o Git contam histórias diferentes sobre esta frente.">Divergência Jira × Git</Flag>}
      {p.declaredWithoutEvidence && <Flag title="A planilha diz que foi entregue, mas não há produção confirmada.">Declarada entregue, sem evidência</Flag>}
    </>
  );
}

/** "Semana 1 → Semana 2 → Semana 3": older plans struck through, the current one in bold. */
export function PlanLine({ ws, replans }: { ws: Workstream; replans: number }) {
  if (ws.plans.length === 0) return <p className="text-[11px] text-fog">Sem plano registrado.</p>;
  const last = ws.plans.length - 1;
  return (
    <p className="text-[11px] leading-snug text-fog">
      <span className="sr-only">Plano: </span>
      {ws.plans.map((p, i) => (
        <span key={`${p.recordedAt}-${i}`}>
          {i > 0 && <span aria-hidden> → </span>}
          {i === last ? (
            <span className="font-semibold text-snow">
              {p.label}
              {p.target ? ` · ${shortDate(p.target)}` : ''}
            </span>
          ) : (
            <s title="Plano anterior" className="opacity-70">
              {p.label}
            </s>
          )}
        </span>
      ))}
      {replans > 0 && <span className="ml-1.5 rounded bg-white/[0.08] px-1 py-px text-[10px] font-semibold text-warn">replanejada {replans}x</span>}
    </p>
  );
}

export function TeamRows({ view, compact = false }: { view: WorkstreamView; compact?: boolean }) {
  if (view.people.length === 0) return <p className="text-[11px] text-fog">Time não informado.</p>;
  const byRole = new Map<StaffRole, WorkstreamView['people']>();
  for (const m of view.people) byRole.set(m.assignment.role, [...(byRole.get(m.assignment.role) ?? []), m]);
  return (
    <ul className="space-y-1">
      {ROLE_ORDER.filter((r) => byRole.has(r)).map((r) => (
        <li key={r} className="flex flex-wrap items-center gap-1">
          <span className="w-7 shrink-0 font-mono text-[10px] font-semibold text-forge-bright">{ROLE_LABEL[r]}</span>
          {byRole.get(r)!.map((m, i) => (
            <span key={`${m.assignment.displayName}-${i}`} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-snow">
              {m.person?.displayName ?? m.assignment.displayName}
              {m.assignment.specialty && !compact && <span className="text-fog"> ({m.assignment.specialty})</span>}
              {m.assignment.specialty && compact && r === 'dev' && <span className="text-fog"> {m.assignment.specialty}</span>}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function Dependencies({ ws }: { ws: Workstream }) {
  if (ws.dependencies.length === 0) return null;
  return (
    <ul className="space-y-1">
      {ws.dependencies.map((d, i) => (
        <li
          key={i}
          className={`flex items-start gap-1.5 rounded-md px-1.5 py-1 text-[11px] leading-snug ${d.kind === 'blocker' ? 'bg-fail/10 text-fail' : 'bg-warn/10 text-warn'}`}
        >
          <Icon name={d.kind === 'blocker' ? 'alert' : 'clock'} size={12} className="mt-px shrink-0" />
          <span>
            <strong>{d.kind === 'blocker' ? 'Bloqueio: ' : 'Aguardando: '}</strong>
            {d.description}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LinkList({ ws }: { ws: Workstream }) {
  if (ws.links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {ws.links.map((l) => (
        <EvidenceLink key={l.url} href={l.url}>
          {l.label}
        </EvidenceLink>
      ))}
    </div>
  );
}
