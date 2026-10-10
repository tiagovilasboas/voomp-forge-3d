import { useMemo } from 'react';
import type { ContributorRole, ReviewVerdict } from '@domain/entities';
import { personSummary } from '@application/queries/summaries';
import { useReadyData } from '../../../state/dataStore';
import { useScope } from '../../../state/selectors';
import { useUiStore } from '../../../state/uiStore';
import { STATUS_LOOK } from '../../../theme';
import { Chip, StatusBadge } from '../../kit/primitives';
import { useVocabulary } from '../../views/viewHooks';
import { InspectorHeader } from './InspectorHeader';
import { Chips, ListRow, Muted, Notice, Section } from './inspectorParts';

const ROLE_LABEL: Record<ContributorRole, string> = {
  developer: 'Desenvolvimento',
  reviewer: 'Revisão de código',
  'tech-lead': 'Tech lead',
  'product-manager': 'Produto',
};

const VERDICT_LABEL: Record<ReviewVerdict, string> = {
  approved: 'Aprovou',
  changes_requested: 'Pediu ajustes',
  commented: 'Comentou',
};

/** Participation only. No scores, rankings, presence or productivity — by design. */
export function PersonInspector({ id }: { id: string }) {
  const { index } = useReadyData();
  const scope = useScope();
  const vocab = useVocabulary();
  const select = useUiStore((s) => s.select);
  const summary = useMemo(() => personSummary(index, id, scope), [index, id, scope]);
  const { person, squad, authored, reviews, reviewedDeliveries, productionParticipation } = summary;

  const verdictOf = (crId: string) => {
    const mine = reviews.find((r) => r.changeRequestId === crId);
    return mine ? VERDICT_LABEL[mine.verdict] : '';
  };
  const openCr = (crId: string) => () => select({ kind: 'cr', id: crId });

  return (
    <>
      <InspectorHeader
        icon="person"
        eyebrow={`Pessoa · @${person.handle}`}
        title={person.displayName}
        subline={person.role ? ROLE_LABEL[person.role] : 'Função não informada'}
        target={{ kind: 'person', id }}
      />
      <Chips>
        {squad && (
          <button type="button" aria-label={`Abrir squad ${squad.name}`} onClick={() => select({ kind: 'squad', id: squad.id })} className="focus-ring rounded-md">
            <Chip tone="forge">{`SQ-${squad.code} · ${squad.name}`}</Chip>
          </button>
        )}
        <Chip>últimos {scope.periodDays} dias</Chip>
      </Chips>

      <Section title="Mudanças de autoria">
        {authored.length === 0 && <Muted>Nenhuma mudança de autoria no período.</Muted>}
        {authored.map((d) => (
          <ListRow
            key={d.cr.id}
            title={`${vocab.changeRequestShort} #${d.cr.number} · ${d.cr.productSummary ?? d.cr.title}`}
            sub={d.repo.name}
            ariaLabel={`Abrir ${vocab.changeRequestShort} #${d.cr.number}`}
            onClick={openCr(d.cr.id)}
            right={<StatusBadge look={STATUS_LOOK[d.status]} compact />}
          />
        ))}
      </Section>

      <Section title="Revisões realizadas" aside={<span>{reviews.length} no período</span>}>
        {reviewedDeliveries.length === 0 && <Muted>Nenhuma revisão no período.</Muted>}
        {reviewedDeliveries.map((d) => (
          <ListRow
            key={d.cr.id}
            icon="eye"
            title={`${vocab.changeRequestShort} #${d.cr.number} · ${d.cr.productSummary ?? d.cr.title}`}
            sub={`${d.repo.name} · ${verdictOf(d.cr.id)}`}
            ariaLabel={`Abrir ${vocab.changeRequestShort} #${d.cr.number}`}
            onClick={openCr(d.cr.id)}
          />
        ))}
      </Section>

      <Section title="Participação em entregas em produção">
        {productionParticipation.length === 0 && <Muted>Nenhuma entrega em produção no período.</Muted>}
        {productionParticipation.map((d) => (
          <ListRow
            key={d.cr.id}
            icon="rocket"
            title={`${vocab.changeRequestShort} #${d.cr.number} · ${d.cr.productSummary ?? d.cr.title}`}
            sub={d.repo.name}
            ariaLabel={`Abrir ${vocab.changeRequestShort} #${d.cr.number}`}
            onClick={openCr(d.cr.id)}
          />
        ))}
      </Section>

      <div className="pb-4">
        <Notice>
          Personagens são ilustrativos: não indicam presença, carga ou produtividade. Esta lista mostra participação, não desempenho: não há ranking nem nota.
        </Notice>
      </div>
    </>
  );
}
