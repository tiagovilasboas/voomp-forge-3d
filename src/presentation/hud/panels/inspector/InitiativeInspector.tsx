import { useMemo } from 'react';
import { STATUS_GROUP, type Delivery, type StatusGroup } from '@application/queries/deliveries';
import { initiativeSummary } from '@application/queries/initiatives';
import { useReadyData } from '../../../state/dataStore';
import { useScope } from '../../../state/selectors';
import { useUiStore } from '../../../state/uiStore';
import { STATUS_LOOK } from '../../../theme';
import { Chip, EmptyState, StatTile, StatusBadge } from '../../kit/primitives';
import { STATUS_GROUP_LABEL, STATUS_GROUP_ORDER } from '../../views/deliveryLabels';
import { useVocabulary } from '../../views/viewHooks';
import { InspectorHeader } from './InspectorHeader';
import { Chips, ListRow, Notice, Section, TileGrid } from './inspectorParts';

function groupByStatus(deliveries: Delivery[]): [StatusGroup, Delivery[]][] {
  return STATUS_GROUP_ORDER.map((g): [StatusGroup, Delivery[]] => [g, deliveries.filter((d) => STATUS_GROUP[d.status] === g)]).filter(([, list]) => list.length > 0);
}

export function InitiativeInspector({ id }: { id: string }) {
  const { index } = useReadyData();
  const scope = useScope();
  const vocab = useVocabulary();
  const select = useUiStore((s) => s.select);
  const summary = useMemo(() => initiativeSummary(index, id, scope), [index, id, scope]);
  const { initiative, deliveries, repositories } = summary;
  const owner = index.squad.get(initiative.ownerSquadId);
  const groups = useMemo(() => groupByStatus(deliveries), [deliveries]);

  return (
    <>
      <InspectorHeader icon="target" eyebrow={`Iniciativa · ${initiative.key}`} title={initiative.name} subline={initiative.summary} />
      <Chips>
        {owner && <Chip tone="forge">{`SQ-${owner.code} · ${owner.name}`}</Chip>}
        <Chip>últimos {scope.periodDays} dias</Chip>
      </Chips>
      <Notice>{summary.headline}</Notice>
      <TileGrid>
        <StatTile icon="rocket" label="Em produção" value={summary.inProduction.length} />
        <StatTile icon="merge" label="Aguardando produção" value={summary.notYetInProduction.length} hint="integradas ou em staging" />
        <StatTile icon="eye" label="Em revisão" value={summary.inReview.length} />
        <StatTile icon="alert" label="Bloqueadas" value={summary.blocked.length} />
      </TileGrid>

      {deliveries.length === 0 ? (
        <EmptyState icon="moon" title="Sem entregas no período">
          Nenhuma {vocab.changeRequest.toLowerCase()} vinculada a esta iniciativa.
        </EmptyState>
      ) : (
        <>
          <Section title="Repositórios envolvidos">
            {repositories.map((r) => (
              <ListRow key={r.id} icon="rack" title={r.name} sub={r.language} ariaLabel={`Abrir repositório ${r.name}`} onClick={() => select({ kind: 'repo', id: r.id })} />
            ))}
          </Section>
          {groups.map(([group, list]) => (
            <Section key={group} title={STATUS_GROUP_LABEL[group]} aside={<span>{list.length}</span>}>
              {list.map((d) => (
                <ListRow
                  key={d.cr.id}
                  title={`${vocab.changeRequestShort} #${d.cr.number} · ${d.cr.productSummary ?? d.cr.title}`}
                  sub={d.repo.name}
                  ariaLabel={`Abrir ${vocab.changeRequestShort} #${d.cr.number}`}
                  onClick={() => select({ kind: 'cr', id: d.cr.id })}
                  right={<StatusBadge look={STATUS_LOOK[d.status]} compact />}
                />
              ))}
            </Section>
          ))}
        </>
      )}
      <div className="pb-3" />
    </>
  );
}
