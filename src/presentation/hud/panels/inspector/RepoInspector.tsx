import { useMemo } from 'react';
import { toDelivery } from '@application/queries/deliveries';
import { inPeriod } from '@application/queries/period';
import { useReadyData } from '../../../state/dataStore';
import { useRepoHealth, useScope } from '../../../state/selectors';
import { useUiStore } from '../../../state/uiStore';
import { SIGNAL_LOOK, STATUS_LOOK } from '../../../theme';
import { EvidenceLink } from '../../kit/EvidenceLink';
import { Icon } from '../../kit/Icon';
import { Chip, StatTile, StatusBadge } from '../../kit/primitives';
import { relativeTime, shortSha } from '../../kit/format';
import { ENVIRONMENT_LABEL } from '../../views/deliveryLabels';
import { useSnapshotNow, useVocabulary } from '../../views/viewHooks';
import { InspectorHeader } from './InspectorHeader';
import { Chips, deploymentStatusLook, ListRow, Muted, pipelineStatusLook, Section, TileGrid, repoSignal } from './inspectorParts';

const COMMITS_SHOWN = 5;
const CHANGES_SHOWN = 5;

export function RepoInspector({ id }: { id: string }) {
  const { index } = useReadyData();
  const scope = useScope();
  const health = useRepoHealth().get(id);
  const now = useSnapshotNow();
  const vocab = useVocabulary();
  const select = useUiStore((s) => s.select);
  const engineering = useUiStore((s) => s.viewMode === 'engineering');

  const repo = index.repo.get(id)!;
  const squad = index.squad.get(repo.squadId);
  const commits = useMemo(() => index.commitsByRepo.get(id) ?? [], [index, id]);
  const changes = useMemo(() => (index.crsByRepo.get(id) ?? []).slice(0, CHANGES_SHOWN).map((cr) => toDelivery(index, cr)), [index, id]);
  const commitsInPeriod = commits.filter((c) => inPeriod(scope, c.committedAt)).length;
  const latestRun = health?.pipeline.latest ?? null;
  const deploy = health?.lastDeployment ?? null;

  return (
    <>
      <InspectorHeader icon="rack" eyebrow={`Repositório · ${squad ? `SQ-${squad.code}` : 'sem squad'}`} title={repo.name} subline={repo.description} target={{ kind: 'repo', id }} />
      <Chips>
        <Chip>
          <Icon name="branch" size={12} className="mr-1" />
          {repo.defaultBranch}
        </Chip>
        <Chip>{repo.language}</Chip>
        <StatusBadge look={SIGNAL_LOOK[repoSignal(health)]} />
      </Chips>
      <TileGrid>
        <StatTile icon="branch" label="Mudanças abertas" value={health?.openChanges ?? 0} />
        <StatTile icon="alert" label="Bloqueadas" value={health?.blockedChanges ?? 0} />
        <StatTile icon="commit" label="Commits" value={commitsInPeriod} hint={`últimos ${scope.periodDays} dias`} />
        <StatTile icon="pulse" label="Última atividade" value={<span className="text-sm">{relativeTime(health?.lastActivityAt, now)}</span>} />
      </TileGrid>

      <Section title="Saúde do repositório">
        {(health?.modules ?? []).map((m) => (
          <ListRow key={m.id} title={m.label} right={<StatusBadge look={SIGNAL_LOOK[m.signal]} />} />
        ))}
      </Section>

      <Section title="Últimos commits">
        {commits.length === 0 && <Muted>Nenhum commit conhecido.</Muted>}
        {commits.slice(0, COMMITS_SHOWN).map((c) => (
          <ListRow
            key={c.sha}
            icon="commit"
            title={c.message}
            sub={`${index.person.get(c.authorId)?.displayName ?? 'Autoria desconhecida'} · ${relativeTime(c.committedAt, now)}`}
            right={engineering && <span className="font-mono text-[10px] text-fog">{shortSha(c.sha)}</span>}
          />
        ))}
      </Section>

      <Section title="Mudanças recentes">
        {changes.length === 0 && <Muted>Nenhuma mudança registrada.</Muted>}
        {changes.map((d) => (
          <ListRow
            key={d.cr.id}
            title={`${vocab.changeRequestShort} #${d.cr.number} · ${d.cr.productSummary ?? d.cr.title}`}
            ariaLabel={`Abrir ${vocab.changeRequestShort} #${d.cr.number}`}
            onClick={() => select({ kind: 'cr', id: d.cr.id })}
            right={<StatusBadge look={STATUS_LOOK[d.status]} compact />}
          />
        ))}
      </Section>

      <Section title={vocab.pipeline}>
        {latestRun ? (
          <ListRow
            title={latestRun.pipelineName}
            sub={`${latestRun.branch} · ${relativeTime(latestRun.startedAt, now)}`}
            right={<StatusBadge look={pipelineStatusLook(latestRun.status)} />}
          />
        ) : (
          <Muted>Sem dados de {vocab.pipeline.toLowerCase()} para este repositório.</Muted>
        )}
        {latestRun && (
          <div className="px-2 pb-1">
            <EvidenceLink href={latestRun.webUrl}>Ver última execução</EvidenceLink>
          </div>
        )}
      </Section>

      <Section title="Último deploy">
        {deploy ? (
          <>
            <ListRow
              title={ENVIRONMENT_LABEL[deploy.environment]}
              sub={`${relativeTime(deploy.createdAt, now)}${engineering ? ` · ${shortSha(deploy.sha)}` : ''}`}
              right={<StatusBadge look={deploymentStatusLook(deploy.status)} />}
            />
            <div className="px-2 pb-1">
              <EvidenceLink href={deploy.webUrl}>Ver deploy</EvidenceLink>
            </div>
          </>
        ) : (
          <Muted>Nenhum deploy conhecido.</Muted>
        )}
      </Section>

      <div className="px-4 pt-2 pb-4">
        <EvidenceLink href={repo.webUrl}>Abrir repositório</EvidenceLink>
      </div>
    </>
  );
}
