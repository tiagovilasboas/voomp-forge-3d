import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useReadyData } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';
import { SIGNAL_LOOK, STATUS_LOOK, type Look } from '@presentation/theme';
import type { DeploymentStatus, PipelineStatus } from '@domain/entities';
import { Card, EmptyState, StatusBadge } from '@presentation/hud/kit/primitives';
import { relativeTime } from '@presentation/hud/kit/format';
import { ActivityRow } from './activity/ActivityRow';
import { useActivity } from './activity/useActivity';

type TabId = 'deliveries' | 'reviews' | 'pipelines' | 'deploys';

const MAX_ROWS = 30;

const RUN_LOOK: Record<PipelineStatus, Look> = {
  success: { ...SIGNAL_LOOK.success, label: 'Sucesso' },
  failure: { ...SIGNAL_LOOK.error, label: 'Falhou' },
  running: { ...SIGNAL_LOOK.active, label: 'Em andamento' },
  cancelled: { ...SIGNAL_LOOK.idle, label: 'Cancelado' },
};

const DEPLOY_LOOK: Record<DeploymentStatus, Look> = {
  success: RUN_LOOK.success,
  failure: RUN_LOOK.failure,
  running: RUN_LOOK.running,
};

const EMPTY_COPY: Record<TabId, { title: string; text: string }> = {
  deliveries: { title: 'Nenhuma entrega no período', text: 'Quando algo for integrado ou chegar a staging/produção, aparece aqui.' },
  reviews: { title: 'Nada aguardando revisão', text: 'Sem mudanças esperando revisão ou com ajustes pedidos.' },
  pipelines: { title: 'Nenhum pipeline no período', text: 'Tente ampliar o período ou escolher outra squad.' },
  deploys: { title: 'Nenhum deploy no período', text: 'Tente ampliar o período ou escolher outra squad.' },
};

function useTabs(): { id: TabId; label: string; count: number; rows: ReactNode[] }[] {
  const { index, snapshot } = useReadyData();
  const select = useUiStore((s) => s.select);
  const track = useUiStore((s) => s.track);
  const activity = useActivity();
  const now = useMemo(() => new Date(snapshot.source.generatedAt), [snapshot]);
  const repoName = (id: string) => index.repo.get(id)?.name ?? id;

  const deliveryRow = (d: (typeof activity.deliveries)[number], actionLabel: string, onAction: () => void) => (
    <ActivityRow
      key={d.cr.id}
      icon={STATUS_LOOK[d.status].icon}
      title={`#${d.cr.number} ${d.cr.productSummary ?? d.cr.title}`}
      subline={`${d.repo.name} · ${relativeTime(d.lastActivityAt, now)}`}
      onOpen={() => select({ kind: 'cr', id: d.cr.id })}
      badge={<StatusBadge look={STATUS_LOOK[d.status]} compact />}
      action={{ label: actionLabel, onClick: onAction, ariaLabel: `${actionLabel} #${d.cr.number}` }}
    />
  );

  return [
    {
      id: 'deliveries',
      label: 'Entregas',
      count: activity.deliveries.length,
      rows: activity.deliveries.slice(0, MAX_ROWS).map((d) => deliveryRow(d, 'Acompanhar', () => track(d.cr.id))),
    },
    {
      id: 'reviews',
      label: 'Revisões',
      count: activity.reviews.length,
      rows: activity.reviews.slice(0, MAX_ROWS).map((d) => deliveryRow(d, 'Ver', () => select({ kind: 'cr', id: d.cr.id }))),
    },
    {
      id: 'pipelines',
      label: 'Pipelines',
      count: activity.pipelines.length,
      rows: activity.pipelines.slice(0, MAX_ROWS).map((r) => (
        <ActivityRow
          key={r.id}
          icon={RUN_LOOK[r.status].icon}
          title={r.pipelineName}
          subline={`${repoName(r.repositoryId)} · ${r.branch} · ${relativeTime(r.startedAt, now)}`}
          onOpen={() => select(r.changeRequestId ? { kind: 'cr', id: r.changeRequestId } : { kind: 'repo', id: r.repositoryId })}
          badge={<StatusBadge look={RUN_LOOK[r.status]} compact />}
          action={{
            label: 'Ver',
            onClick: () => select({ kind: 'repo', id: r.repositoryId }),
            ariaLabel: `Ver repositório ${repoName(r.repositoryId)}`,
          }}
        />
      )),
    },
    {
      id: 'deploys',
      label: 'Deploys',
      count: activity.deploys.length,
      rows: activity.deploys.slice(0, MAX_ROWS).map((d) => (
        <ActivityRow
          key={d.id}
          icon={d.environment === 'production' ? 'rocket' : 'flask'}
          title={`${d.environment === 'production' ? 'Produção' : 'Staging'} · ${repoName(d.repositoryId)}`}
          subline={relativeTime(d.createdAt, now)}
          onOpen={() => select({ kind: 'repo', id: d.repositoryId })}
          badge={<StatusBadge look={DEPLOY_LOOK[d.status]} compact />}
          action={{
            label: 'Ver',
            onClick: () => select({ kind: 'repo', id: d.repositoryId }),
            ariaLabel: `Ver repositório ${repoName(d.repositoryId)}`,
          }}
        />
      )),
    },
  ];
}

/** Activity queues (WareTrack Orders/Docks/Forklifts/Trucks): deliveries, reviews, pipelines, deploys. */
export function ActivityTabs() {
  const tabs = useTabs();
  const [active, setActive] = useState<TabId>('deliveries');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(i + step + tabs.length) % tabs.length];
    setActive(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <Card label="Atividade" className="flex h-full flex-col">
      <div role="tablist" aria-label="Atividade" className="scroll-thin flex shrink-0 gap-3 overflow-x-auto border-b border-white/[0.07] px-3 pt-2.5">
        {tabs.map((t, i) => {
          const selected = t.id === current.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`activity-tab-${t.id}`}
              aria-selected={selected}
              aria-controls="activity-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`focus-ring -mb-px flex items-center gap-1 border-b-2 pb-2 tap:min-h-11 tap:items-end text-[12px] font-semibold whitespace-nowrap ${
                selected ? 'border-forge text-snow' : 'border-transparent text-fog hover:text-snow'
              }`}
            >
              {t.label}
              <span className="font-mono text-[10px] text-fog">{t.count}</span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id="activity-panel"
        aria-labelledby={`activity-tab-${current.id}`}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5"
      >
        {current.rows.length === 0 ? (
          <EmptyState title={EMPTY_COPY[current.id].title}>{EMPTY_COPY[current.id].text}</EmptyState>
        ) : (
          <ul className="space-y-0.5">{current.rows}</ul>
        )}
      </div>
    </Card>
  );
}
