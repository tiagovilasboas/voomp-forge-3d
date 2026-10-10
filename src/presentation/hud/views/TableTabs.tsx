import { useMemo } from 'react';
import type { InitiativeStatus } from '@domain/entities';
import { listDeliveries } from '@application/queries/deliveries';
import { initiativeSummaries } from '@application/queries/initiatives';
import { repositoryHealth } from '@application/queries/repositoryHealth';
import { personSummary, squadSummary } from '@application/queries/summaries';
import { useReadyData } from '../../state/dataStore';
import { useScope } from '../../state/selectors';
import type { EntityRef } from '../../world/worldModel';
import { SIGNAL_LOOK, STATUS_LOOK } from '../../theme';
import { relativeTime } from '../kit/format';
import { StatusBadge } from '../kit/primitives';
import { repoSignal } from '../panels/inspector/inspectorParts';
import { ENVIRONMENT_LABEL, NO_INITIATIVE } from './deliveryLabels';
import { SortableTable, type Column } from './SortableTable';
import { useSnapshotNow, useVocabulary } from './viewHooks';

export interface TabTableProps {
  /** Present only in the overlay: embedded mode has no inspector to open. */
  onOpen?: (ref: EntityRef) => void;
}

const INITIATIVE_STATUS: Record<InitiativeStatus, string> = { discovery: 'Descoberta', in_delivery: 'Em entrega', released: 'Lançada' };
const ROLE_LABEL = { developer: 'Desenvolvimento', reviewer: 'Revisão de código', 'tech-lead': 'Tech lead', 'product-manager': 'Produto' } as const;

export function SquadsTable({ onOpen }: TabTableProps) {
  const { snapshot, index } = useReadyData();
  const scope = useScope();
  const rows = useMemo(() => snapshot.squads.filter((s) => !scope.squadId || s.id === scope.squadId).map((s) => squadSummary(index, s.id, scope)), [snapshot, index, scope]);
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { id: 'name', header: 'Squad', render: (r) => `SQ-${r.squad.code} · ${r.squad.name}`, sortValue: (r) => r.squad.name },
    { id: 'repos', header: 'Repositórios', numeric: true, render: (r) => r.repositories.length, sortValue: (r) => r.repositories.length },
    { id: 'people', header: 'Pessoas', numeric: true, render: (r) => r.people.length, sortValue: (r) => r.people.length },
    { id: 'merged', header: 'Integrados', numeric: true, render: (r) => r.kpis.merged, sortValue: (r) => r.kpis.merged },
    { id: 'open', header: 'Abertos', numeric: true, render: (r) => r.openChanges, sortValue: (r) => r.openChanges },
    { id: 'review', header: 'Aguardando revisão', numeric: true, render: (r) => r.kpis.awaitingReview, sortValue: (r) => r.kpis.awaitingReview },
    { id: 'fail', header: 'Falhas de pipeline', numeric: true, render: (r) => r.kpis.pipelineFailures, sortValue: (r) => r.kpis.pipelineFailures },
    { id: 'prod', header: 'Deploys em produção', numeric: true, render: (r) => r.kpis.productionDeploys, sortValue: (r) => r.kpis.productionDeploys },
  ];
  return <SortableTable caption={`Squads, últimos ${scope.periodDays} dias`} columns={columns} rows={rows} rowKey={(r) => r.squad.id} onOpen={onOpen && ((r) => onOpen({ kind: 'squad', id: r.squad.id }))} openLabel={(r) => `Abrir squad ${r.squad.name}`} />;
}

export function ReposTable({ onOpen }: TabTableProps) {
  const { snapshot, index } = useReadyData();
  const scope = useScope();
  const now = useSnapshotNow();
  const rows = useMemo(
    () => snapshot.repositories.filter((r) => !scope.squadId || r.squadId === scope.squadId).map((repo) => ({ repo, health: repositoryHealth(index, repo.id, scope) })),
    [snapshot, index, scope],
  );
  type Row = (typeof rows)[number];
  const squadName = (r: Row) => index.squad.get(r.repo.squadId)?.name ?? '—';
  const columns: Column<Row>[] = [
    { id: 'name', header: 'Repositório', render: (r) => r.repo.name, sortValue: (r) => r.repo.name },
    { id: 'squad', header: 'Squad', render: squadName, sortValue: squadName },
    { id: 'lang', header: 'Linguagem', render: (r) => r.repo.language, sortValue: (r) => r.repo.language },
    { id: 'health', header: 'Saúde', render: (r) => <StatusBadge look={SIGNAL_LOOK[repoSignal(r.health)]} /> },
    { id: 'open', header: 'Abertas', numeric: true, render: (r) => r.health.openChanges, sortValue: (r) => r.health.openChanges },
    { id: 'blocked', header: 'Bloqueadas', numeric: true, render: (r) => r.health.blockedChanges, sortValue: (r) => r.health.blockedChanges },
    {
      id: 'deploy',
      header: 'Último deploy',
      render: (r) => (r.health.lastDeployment ? `${ENVIRONMENT_LABEL[r.health.lastDeployment.environment]} · ${relativeTime(r.health.lastDeployment.createdAt, now)}` : 'Nenhum conhecido'),
    },
  ];
  return <SortableTable caption={`Repositórios, últimos ${scope.periodDays} dias`} columns={columns} rows={rows} rowKey={(r) => r.repo.id} onOpen={onOpen && ((r) => onOpen({ kind: 'repo', id: r.repo.id }))} openLabel={(r) => `Abrir repositório ${r.repo.name}`} />;
}

export function DeliveriesTable({ onOpen }: TabTableProps) {
  const { index } = useReadyData();
  const scope = useScope();
  const now = useSnapshotNow();
  const vocab = useVocabulary();
  const rows = useMemo(() => listDeliveries(index, scope), [index, scope]);
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { id: 'title', header: 'Entrega', render: (d) => `${vocab.changeRequestShort} #${d.cr.number} · ${d.cr.productSummary ?? d.cr.title}`, sortValue: (d) => d.cr.number },
    { id: 'repo', header: 'Repositório', render: (d) => d.repo.name, sortValue: (d) => d.repo.name },
    { id: 'squad', header: 'Squad', render: (d) => d.squad.name, sortValue: (d) => d.squad.name },
    { id: 'status', header: 'Status', render: (d) => <StatusBadge look={STATUS_LOOK[d.status]} />, sortValue: (d) => STATUS_LOOK[d.status].label },
    { id: 'init', header: 'Iniciativa', render: (d) => d.initiative?.name ?? NO_INITIATIVE, sortValue: (d) => d.initiative?.name ?? '' },
    { id: 'last', header: 'Última atividade', render: (d) => relativeTime(d.lastActivityAt, now), sortValue: (d) => d.lastActivityAt },
  ];
  return <SortableTable caption={`Entregas, últimos ${scope.periodDays} dias`} columns={columns} rows={rows} rowKey={(d) => d.cr.id} onOpen={onOpen && ((d) => onOpen({ kind: 'cr', id: d.cr.id }))} openLabel={(d) => `Abrir ${vocab.changeRequestShort} #${d.cr.number}`} />;
}

/** People: participation counts are shown but not sortable, so the table cannot become a ranking. */
export function PeopleTable({ onOpen }: TabTableProps) {
  const { snapshot, index } = useReadyData();
  const scope = useScope();
  const rows = useMemo(
    () => snapshot.contributors.filter((p) => !scope.squadId || p.squadId === scope.squadId).map((p) => personSummary(index, p.id, scope)),
    [snapshot, index, scope],
  );
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { id: 'name', header: 'Pessoa', render: (r) => r.person.displayName, sortValue: (r) => r.person.displayName },
    { id: 'handle', header: 'Usuário', render: (r) => `@${r.person.handle}` },
    { id: 'squad', header: 'Squad', render: (r) => r.squad?.name ?? '—', sortValue: (r) => r.squad?.name ?? '' },
    { id: 'role', header: 'Função', render: (r) => (r.person.role ? ROLE_LABEL[r.person.role] : 'Função não informada') },
    { id: 'authored', header: 'Mudanças de autoria', numeric: true, render: (r) => r.authored.length },
    { id: 'reviews', header: 'Revisões realizadas', numeric: true, render: (r) => r.reviews.length },
  ];
  return <SortableTable caption={`Pessoas, últimos ${scope.periodDays} dias. Participação, não desempenho.`} columns={columns} rows={rows} rowKey={(r) => r.person.id} onOpen={onOpen && ((r) => onOpen({ kind: 'person', id: r.person.id }))} openLabel={(r) => `Abrir pessoa ${r.person.displayName}`} />;
}

export function InitiativesTable({ onOpen }: TabTableProps) {
  const { index } = useReadyData();
  const scope = useScope();
  const rows = useMemo(() => initiativeSummaries(index, scope), [index, scope]);
  type Row = (typeof rows)[number];
  const owner = (r: Row) => index.squad.get(r.initiative.ownerSquadId)?.name ?? '—';
  const columns: Column<Row>[] = [
    { id: 'name', header: 'Iniciativa', render: (r) => `${r.initiative.key} · ${r.initiative.name}`, sortValue: (r) => r.initiative.key },
    { id: 'owner', header: 'Squad responsável', render: owner, sortValue: owner },
    { id: 'status', header: 'Situação', render: (r) => INITIATIVE_STATUS[r.initiative.status], sortValue: (r) => INITIATIVE_STATUS[r.initiative.status] },
    { id: 'prod', header: 'Em produção', numeric: true, render: (r) => r.inProduction.length, sortValue: (r) => r.inProduction.length },
    { id: 'wait', header: 'Aguardando produção', numeric: true, render: (r) => r.notYetInProduction.length, sortValue: (r) => r.notYetInProduction.length },
    { id: 'review', header: 'Em revisão', numeric: true, render: (r) => r.inReview.length, sortValue: (r) => r.inReview.length },
    { id: 'blocked', header: 'Bloqueadas', numeric: true, render: (r) => r.blocked.length, sortValue: (r) => r.blocked.length },
  ];
  return <SortableTable caption={`Iniciativas, últimos ${scope.periodDays} dias`} columns={columns} rows={rows} rowKey={(r) => r.initiative.id} onOpen={onOpen && ((r) => onOpen({ kind: 'initiative', id: r.initiative.id }))} openLabel={(r) => `Abrir iniciativa ${r.initiative.name}`} />;
}
