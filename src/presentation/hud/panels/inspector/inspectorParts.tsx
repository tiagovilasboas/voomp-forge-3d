import type { ReactNode } from 'react';
import type { PipelineStatus, DeploymentStatus } from '@domain/entities';
import type { RepositoryHealth, Signal } from '@application/queries/repositoryHealth';
import { SIGNAL_LOOK, type IconName, type Look } from '../../../theme';
import { Icon } from '../../kit/Icon';
import { SectionLabel } from '../../kit/primitives';

/** Small building blocks shared by the inspector variants. */

export function Section({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <SectionLabel aside={aside}>{title}</SectionLabel>
      <div className="px-2 pb-1">{children}</div>
    </section>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">{children}</div>;
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 px-4 pt-3">{children}</div>;
}

interface ListRowProps {
  onClick?: () => void;
  ariaLabel?: string;
  icon?: IconName;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}

/** A row that is a button when it navigates somewhere, plain text otherwise. */
export function ListRow({ onClick, ariaLabel, icon, title, sub, right }: ListRowProps) {
  const body = (
    <>
      {icon && <Icon name={icon} size={14} className="mt-0.5 shrink-0 text-fog" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-snow">{title}</span>
        {sub && <span className="block truncate text-[11px] text-fog">{sub}</span>}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </>
  );
  const base = 'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left';
  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} className={`${base} focus-ring transition hover:bg-white/[0.06]`}>
      {body}
    </button>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="px-2 py-1.5 text-[11px] text-fog">{children}</p>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="mx-4 mt-3 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] leading-snug text-fog">{children}</p>;
}

/** Whole-repository signal for lists: alert > recent activity > idle > ok. */
export function repoSignal(h: RepositoryHealth | undefined): Signal {
  if (!h) return 'unknown';
  if (h.alert) return 'error';
  if (h.hot) return 'active';
  if (h.idle) return 'idle';
  return 'success';
}

const runLook = (signal: Signal, label: string): Look => ({ ...SIGNAL_LOOK[signal], label });

export const pipelineStatusLook = (s: PipelineStatus): Look =>
  ({
    success: runLook('success', 'Sucesso'),
    failure: runLook('error', 'Falhou'),
    running: runLook('active', 'Em execução'),
    cancelled: runLook('idle', 'Cancelado'),
  })[s];

export const deploymentStatusLook = (s: DeploymentStatus): Look =>
  ({
    success: runLook('success', 'Sucesso'),
    failure: runLook('error', 'Falhou'),
    running: runLook('active', 'Em andamento'),
  })[s];
