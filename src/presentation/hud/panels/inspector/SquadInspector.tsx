import { useMemo } from 'react';
import { squadSummary } from '@application/queries/summaries';
import { useReadyData } from '../../../state/dataStore';
import { useRepoHealth, useScope } from '../../../state/selectors';
import { useUiStore } from '../../../state/uiStore';
import { SIGNAL_LOOK, STATUS_LOOK } from '../../../theme';
import { Chip, StatTile, StatusBadge } from '../../kit/primitives';
import { relativeTime } from '../../kit/format';
import { useSnapshotNow } from '../../views/viewHooks';
import { DocumentsSection } from './DocumentsSection';
import { InspectorHeader } from './InspectorHeader';
import { Chips, ListRow, Muted, repoSignal, Section, TileGrid } from './inspectorParts';

export function SquadInspector({ id }: { id: string }) {
  const { index } = useReadyData();
  const scope = useScope();
  const health = useRepoHealth();
  const now = useSnapshotNow();
  const select = useUiStore((s) => s.select);
  const summary = useMemo(() => squadSummary(index, id, scope), [index, id, scope]);
  const { squad, repositories, people, kpis, openChanges, recentDeliveries } = summary;

  return (
    <>
      <InspectorHeader icon="squad" eyebrow={`Squad · SQ-${squad.code}`} title={squad.name} subline={squad.description} target={{ kind: 'squad', id }} />
      <Chips>
        <Chip>{repositories.length} repositórios</Chip>
        <Chip>{people.length} pessoas</Chip>
        <Chip>últimos {scope.periodDays} dias</Chip>
      </Chips>
      <TileGrid>
        <StatTile icon="merge" label="Integrados" value={kpis.merged} hint="no período" />
        <StatTile icon="branch" label="Abertos" value={openChanges} hint="ainda em andamento" />
        <StatTile icon="eye" label="Aguardando revisão" value={kpis.awaitingReview} />
        <StatTile icon="alert" label="Falhas de pipeline" value={kpis.pipelineFailures} />
        <StatTile icon="rocket" label="Deploys em produção" value={kpis.productionDeploys} />
      </TileGrid>
      <Section title="Repositórios">
        {repositories.map((r) => {
          const look = SIGNAL_LOOK[repoSignal(health.get(r.id))];
          return (
            <ListRow
              key={r.id}
              icon="rack"
              title={r.name}
              sub={r.language}
              ariaLabel={`Abrir repositório ${r.name}`}
              onClick={() => select({ kind: 'repo', id: r.id })}
              right={<StatusBadge look={look} />}
            />
          );
        })}
      </Section>
      <DocumentsSection docs={index.docsBySquad.get(id)} />
      <Section title="Entregas recentes">
        {recentDeliveries.length === 0 && <Muted>Nenhuma entrega integrada no período.</Muted>}
        {recentDeliveries.map((d) => (
          <ListRow
            key={d.cr.id}
            title={d.cr.productSummary ?? d.cr.title}
            sub={`${d.repo.name} · ${relativeTime(d.lastActivityAt, now)}`}
            ariaLabel={`Abrir entrega #${d.cr.number}`}
            onClick={() => select({ kind: 'cr', id: d.cr.id })}
            right={<StatusBadge look={STATUS_LOOK[d.status]} compact />}
          />
        ))}
      </Section>
    </>
  );
}
