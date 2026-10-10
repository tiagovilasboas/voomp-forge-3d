import { useMemo } from 'react';
import { toDelivery } from '@application/queries/deliveries';
import { useReadyData } from '../../../state/dataStore';
import { useUiStore } from '../../../state/uiStore';
import { STATUS_LOOK } from '../../../theme';
import { EvidenceLink } from '../../kit/EvidenceLink';
import { Chip, StatTile, StatusBadge } from '../../kit/primitives';
import { relativeTime, shortSha } from '../../kit/format';
import { ENVIRONMENT_LABEL, NO_INITIATIVE, NO_PRODUCT_SUMMARY } from '../../views/deliveryLabels';
import { useSnapshotNow, useVocabulary } from '../../views/viewHooks';
import { InspectorHeader } from './InspectorHeader';
import { Chips, deploymentStatusLook, ListRow, Muted, pipelineStatusLook, Section, TileGrid } from './inspectorParts';
import { StageTimeline } from './StageTimeline';

const VERDICT_LABEL = { approved: 'Aprovou', changes_requested: 'Pediu ajustes', commented: 'Comentou' } as const;

export function ChangeInspector({ id }: { id: string }) {
  const { index } = useReadyData();
  const now = useSnapshotNow();
  const vocab = useVocabulary();
  const select = useUiStore((s) => s.select);
  const track = useUiStore((s) => s.track);
  const trackedCrId = useUiStore((s) => s.trackedCrId);
  const engineering = useUiStore((s) => s.viewMode === 'engineering');

  const delivery = useMemo(() => toDelivery(index, index.cr.get(id)!), [index, id]);
  const { cr, repo, initiative, stages } = delivery;
  const author = index.person.get(cr.authorId);
  const reviews = index.reviewsByCr.get(id) ?? [];
  const runs = index.runsBySha.get(cr.headSha) ?? [];
  const deployments = index.deploymentsByCr.get(id) ?? [];
  const evidenced = stages.filter((s) => s.state === 'done').length;

  return (
    <>
      <InspectorHeader
        icon="merge"
        eyebrow={`${vocab.changeRequest} · #${cr.number}`}
        title={cr.title}
        subline={
          <button type="button" aria-label={`Abrir repositório ${repo.name}`} onClick={() => select({ kind: 'repo', id: repo.id })} className="focus-ring rounded font-semibold text-forge-bright hover:underline">
            {repo.name}
          </button>
        }
        target={{ kind: 'cr', id }}
      />
      <Chips>
        <StatusBadge look={STATUS_LOOK[delivery.status]} />
        {delivery.environments.map((e) => (
          <Chip key={e}>{ENVIRONMENT_LABEL[e]}</Chip>
        ))}
      </Chips>
      <TileGrid>
        <StatTile icon="check" label="Etapas com evidência" value={`${evidenced}/${stages.length}`} />
        <StatTile icon="eye" label="Revisões" value={reviews.length} />
        <StatTile icon="person" label="Autoria" value={<span className="text-sm">{author?.displayName ?? 'Desconhecida'}</span>} />
        <StatTile icon="clock" label="Última atividade" value={<span className="text-sm">{relativeTime(delivery.lastActivityAt, now)}</span>} />
      </TileGrid>

      <Section title="Iniciativa">
        {initiative ? (
          <ListRow
            icon="target"
            title={initiative.name}
            sub={initiative.key}
            ariaLabel={`Abrir iniciativa ${initiative.name}`}
            onClick={() => select({ kind: 'initiative', id: initiative.id })}
          />
        ) : (
          <Muted>{NO_INITIATIVE}</Muted>
        )}
      </Section>

      <Section title="Resumo para Produto">
        <p className="px-2 py-1 text-xs leading-snug text-snow">{cr.productSummary ?? <span className="text-fog">{NO_PRODUCT_SUMMARY}</span>}</p>
      </Section>

      <Section title="Linha do tempo">
        <StageTimeline stages={stages} />
      </Section>

      {engineering && (
        <>
          <Section title="Detalhes técnicos">
            <ListRow title="Versão (head)" right={<span className="font-mono text-[11px] text-fog">{shortSha(cr.headSha)}</span>} />
            <ListRow title="Branch de destino" right={<span className="font-mono text-[11px] text-fog">{cr.targetBranch}</span>} />
          </Section>
          <Section title="Revisões">
            {reviews.length === 0 && <Muted>Nenhuma revisão registrada.</Muted>}
            {reviews.map((r) => (
              <ListRow
                key={r.id}
                icon="eye"
                title={index.person.get(r.reviewerId)?.displayName ?? 'Pessoa desconhecida'}
                sub={`${VERDICT_LABEL[r.verdict]} · ${relativeTime(r.submittedAt, now)}`}
              />
            ))}
          </Section>
          <Section title={`${vocab.pipeline} na versão atual`}>
            {runs.length === 0 && <Muted>Nenhuma execução encontrada para esta versão.</Muted>}
            {runs.map((r) => (
              <ListRow
                key={r.id}
                title={r.pipelineName}
                sub={<EvidenceLink href={r.webUrl}>{`${r.branch} · ${relativeTime(r.startedAt, now)}`}</EvidenceLink>}
                right={<StatusBadge look={pipelineStatusLook(r.status)} />}
              />
            ))}
          </Section>
          <Section title="Deploys contendo esta mudança">
            {deployments.length === 0 && <Muted>Nenhum deploy encontrado.</Muted>}
            {deployments.map((d) => (
              <ListRow
                key={d.id}
                icon="rocket"
                title={`${ENVIRONMENT_LABEL[d.environment]} · ${shortSha(d.sha)}`}
                sub={<EvidenceLink href={d.webUrl}>{relativeTime(d.createdAt, now)}</EvidenceLink>}
                right={<StatusBadge look={deploymentStatusLook(d.status)} />}
              />
            ))}
          </Section>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2 pb-4">
        <EvidenceLink href={cr.webUrl}>{`Abrir ${vocab.changeRequestShort} #${cr.number}`}</EvidenceLink>
        <button
          type="button"
          onClick={() => track(id)}
          aria-pressed={trackedCrId === id}
          className="focus-ring rounded-lg bg-forge px-3 py-1.5 text-xs font-bold text-ink-950 transition hover:bg-forge-bright"
        >
          {trackedCrId === id ? 'Acompanhando' : 'Acompanhar'}
        </button>
      </div>
    </>
  );
}
