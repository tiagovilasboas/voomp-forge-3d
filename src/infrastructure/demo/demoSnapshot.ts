/**
 * Hand-authored demo dataset for Voomp Forge.
 *
 * Everything is fictional and deterministic. All timestamps are offsets from `now`
 * (in days), so the data always covers "the last 30 days".
 */
import type {
  ChangeRequest,
  Commit,
  Contributor,
  ContributorRole,
  Deployment,
  DeploymentEnvironment,
  DeploymentStatus,
  ForgeSnapshot,
  PipelineRun,
  PipelineStatus,
  ProductInitiative,
  Repository,
  Review,
  WorkItemRef,
  DocumentKind,
  ReviewVerdict,
  Squad,
} from '@domain/entities';
import { SNAPSHOT_SCHEMA_VERSION } from '@domain/entities';

const BASE_URL = 'https://git.demo.voomp.invalid/voomp-demo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tiny deterministic string hash -> 40 hex chars (looks like a git sha). */
function sha(seed: string): string {
  let out = '';
  for (let i = 0; i < 5; i++) {
    let h = 2166136261 ^ (i * 16777619);
    for (const ch of `${seed}:${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

const crId = (repo: string, n: number) => `cr-${repo}-${n}`;
const repoId = (repo: string) => `repo-${repo}`;
const ctId = (handle: string) => `ct-${handle}`;

// ---------------------------------------------------------------------------
// Static tables
// ---------------------------------------------------------------------------

const SQUADS: Squad[] = [
  { id: 'sq-admin', code: 'A', name: 'Admin', description: 'Funcionalidades administrativas e de back-office usadas pela operação da Voomp.' },
  { id: 'sq-n3', code: 'B', name: 'Sustentação N3', description: 'Suporte de produção: incidentes, correções urgentes e estabilidade dos pagamentos.' },
  { id: 'sq-enable', code: 'C', name: 'Enablement', description: 'Plataforma, ferramentas e padrões que destravam o trabalho das outras squads.' },
];

// [name, squad, language, description]
const REPOS: Array<[string, string, string, string]> = [
  ['admin-console-web', 'sq-admin', 'TypeScript', 'Console web de administração para a operação e o time financeiro.'],
  ['admin-billing-api', 'sq-admin', 'TypeScript', 'API de cobrança, saldo e repasses para produtores.'],
  ['admin-permissions-svc', 'sq-admin', 'Go', 'Serviço de papéis e permissões por equipe.'],
  ['incident-gateway', 'sq-n3', 'Go', 'Gateway que isola falhas de provedores externos durante incidentes.'],
  ['payments-reconciler', 'sq-n3', 'Kotlin', 'Conciliação diária entre pagamentos, estornos e extratos bancários.'],
  ['legacy-checkout', 'sq-n3', 'PHP', 'Checkout legado, mantido apenas em modo de leitura.'],
  ['forge-ci-templates', 'sq-enable', 'YAML', 'Templates compartilhados de pipeline de integração contínua.'],
  ['design-system', 'sq-enable', 'TypeScript', 'Biblioteca de componentes e tokens visuais usada pelos produtos.'],
  ['platform-observability', 'sq-enable', 'Go', 'Coletores, painéis e alertas de observabilidade da plataforma.'],
];

const squadOf = (repo: string) => REPOS.find(([name]) => name === repo)?.[1] ?? '';

// [handle, name, squad, role]. Two people have no authorised role (null).
const PEOPLE: Array<[string, string, string, ContributorRole | null]> = [
  ['iara-v', 'Iara Venturim', 'sq-admin', 'tech-lead'],
  ['otavio-b', 'Otávio Brisa', 'sq-admin', 'product-manager'],
  ['zelia-k', 'Zélia Kantarini', 'sq-admin', 'developer'],
  ['bento-m', 'Bento Marapuama', 'sq-admin', 'reviewer'],
  ['tupa-r', 'Tupã Ravelli', 'sq-n3', 'tech-lead'],
  ['oriana-c', 'Oriana Capibaribe', 'sq-n3', 'product-manager'],
  ['nilo-q', 'Nilo Quaresmeira', 'sq-n3', 'developer'],
  ['maira-t', 'Maíra Tamoio', 'sq-n3', null],
  ['caetano-u', 'Caetano Urubuí', 'sq-enable', 'tech-lead'],
  ['jandira-f', 'Jandira Folhaverde', 'sq-enable', 'product-manager'],
  ['dalva-p', 'Dalva Pitangueira', 'sq-enable', 'reviewer'],
  ['anselmo-j', 'Anselmo Jabuticaba', 'sq-enable', null],
];

const INITIATIVES: ProductInitiative[] = [
  { id: 'ini-financial-panel', key: 'INI-101', name: 'Painel financeiro do produtor', summary: 'Dar ao produtor uma visão clara de vendas, saldo e repasses em um só lugar.', ownerSquadId: 'sq-admin', status: 'in_delivery' },
  { id: 'ini-team-permissions', key: 'INI-102', name: 'Permissões por equipe', summary: 'Permitir que produtores convidem equipes e controlem o que cada pessoa pode fazer.', ownerSquadId: 'sq-admin', status: 'in_delivery' },
  { id: 'ini-payment-stability', key: 'INI-103', name: 'Estabilidade de pagamentos', summary: 'Reduzir falhas e divergências nos pagamentos e na conciliação.', ownerSquadId: 'sq-n3', status: 'in_delivery' },
  { id: 'ini-unified-ci', key: 'INI-104', name: 'Pipeline unificado de CI', summary: 'Padronizar a integração contínua em todos os repositórios.', ownerSquadId: 'sq-enable', status: 'discovery' },
];
// Knowledge base pages: [id, title, kind, space, squad, initiatives, repos, updated days ago]
const DOCS: Array<[string, string, DocumentKind, string, string | null, string[], string[], number]> = [
  ['doc-fin-spec', 'Especificação: painel financeiro do produtor', 'spec', 'Produto', 'sq-admin', ['ini-financial-panel'], ['admin-console-web', 'admin-billing-api'], 9],
  ['doc-fin-adr', 'ADR-014: saldo calculado no billing, não no front', 'adr', 'ENG', 'sq-admin', ['ini-financial-panel'], ['admin-billing-api'], 20],
  ['doc-perm-spec', 'Especificação: permissões por equipe', 'spec', 'Produto', 'sq-admin', ['ini-team-permissions'], ['admin-permissions-svc', 'design-system'], 6],
  ['doc-perm-adr', 'ADR-017: modelo de papéis baseado em políticas', 'adr', 'ENG', 'sq-admin', ['ini-team-permissions'], ['admin-permissions-svc'], 15],
  ['doc-pay-runbook', 'Runbook: falha do adquirente', 'runbook', 'Operação', 'sq-n3', ['ini-payment-stability'], ['incident-gateway'], 4],
  ['doc-pay-pm', 'Post-mortem: divergência na conciliação de setembro', 'postmortem', 'Operação', 'sq-n3', ['ini-payment-stability'], ['payments-reconciler'], 11],
  ['doc-legacy-guide', 'Guia: checkout legado em modo leitura', 'guide', 'Operação', 'sq-n3', [], ['legacy-checkout'], 52],
  ['doc-ci-adr', 'ADR-021: templates únicos de pipeline', 'adr', 'Plataforma', 'sq-enable', ['ini-unified-ci'], ['forge-ci-templates'], 8],
  ['doc-ds-guide', 'Guia de contribuição do design system', 'guide', 'Plataforma', 'sq-enable', [], ['design-system'], 26],
  ['doc-obs-runbook', 'Runbook: alertas de latência', 'runbook', 'Plataforma', 'sq-enable', [], ['platform-observability'], 13],
];

const INI: Record<string, string> = {
  '101': 'ini-financial-panel',
  '102': 'ini-team-permissions',
  '103': 'ini-payment-stability',
  '104': 'ini-unified-ci',
};

// ---------------------------------------------------------------------------
// Change requests (days are "days ago"; `end` = merged or closed day)
// ---------------------------------------------------------------------------

interface CrRow {
  repo: string;
  n: number;
  title: string;
  summary: string | null;
  author: string;
  state: 'open' | 'closed' | 'merged';
  created: number;
  end?: number;
  draft?: boolean;
  reviewers?: string[];
  ini?: keyof typeof INI;
  commits: 2 | 3;
}

/** Fictional tracker keys per squad. Every fifth change references no task, on purpose. */
const TASK_PREFIX: Record<string, string> = { 'sq-admin': 'ADM', 'sq-n3': 'SUS', 'sq-enable': 'ENB' };
const taskRefs = (squadId: string, index: number): WorkItemRef[] => {
  if (index % 5 === 4) return [];
  const key = `${TASK_PREFIX[squadId] ?? 'TSK'}-${140 + index * 7}`;
  return [{ key, url: `https://tracker.demo.voomp.invalid/browse/${key}` }];
};

const CRS: CrRow[] = [
  // admin-console-web
  { repo: 'admin-console-web', n: 412, title: 'Adiciona tabela de repasses ao painel financeiro', summary: 'O produtor passa a ver cada repasse recebido, com data e valor.', author: 'zelia-k', state: 'merged', created: 22, end: 18, ini: '101', commits: 3 },
  { repo: 'admin-console-web', n: 418, title: 'Filtro por período nos relatórios de vendas', summary: 'Relatórios de vendas podem ser filtrados por semana, mês ou datas personalizadas.', author: 'bento-m', state: 'merged', created: 12, end: 9, ini: '101', commits: 2 },
  { repo: 'admin-console-web', n: 425, title: 'Corrige paginação da lista de produtores', summary: 'A lista de produtores não pula mais registros ao trocar de página.', author: 'zelia-k', state: 'merged', created: 6, end: 3, commits: 2 },
  { repo: 'admin-console-web', n: 429, title: 'Gráfico de receita mensal do produtor', summary: 'Novo gráfico mostra como a receita do produtor evolui mês a mês.', author: 'zelia-k', state: 'open', created: 2, reviewers: ['bento-m', 'iara-v'], ini: '101', commits: 3 },
  { repo: 'admin-console-web', n: 431, title: 'Rascunho: exportação CSV de repasses', summary: 'Permite baixar os repasses em planilha. Ainda em construção.', author: 'bento-m', state: 'open', draft: true, created: 1, ini: '101', commits: 2 },
  // admin-billing-api
  { repo: 'admin-billing-api', n: 208, title: 'Endpoint de saldo disponível para saque', summary: 'O painel consegue mostrar quanto o produtor pode sacar agora.', author: 'iara-v', state: 'merged', created: 20, end: 15, ini: '101', commits: 3 },
  { repo: 'admin-billing-api', n: 214, title: 'Ajusta arredondamento de taxas na liquidação', summary: 'Centavos de taxa deixam de divergir entre extrato e liquidação.', author: 'zelia-k', state: 'merged', created: 8, end: 5, commits: 2 },
  { repo: 'admin-billing-api', n: 217, title: 'Cálculo de comissão por coprodutor', summary: 'A comissão de cada coprodutor é calculada automaticamente a cada venda.', author: 'iara-v', state: 'open', created: 4, ini: '101', commits: 3 },
  { repo: 'admin-billing-api', n: 219, title: 'Cache de extrato por produtor (substituída por #217)', summary: 'Tentativa de acelerar o extrato; descartada em favor de outra abordagem.', author: 'zelia-k', state: 'closed', created: 14, end: 11, commits: 2 },
  // admin-permissions-svc
  { repo: 'admin-permissions-svc', n: 77, title: 'Modelo de papéis por equipe', summary: 'Define os papéis (administrador, financeiro, suporte) que uma equipe pode ter.', author: 'iara-v', state: 'merged', created: 25, end: 19, ini: '102', commits: 3 },
  { repo: 'admin-permissions-svc', n: 83, title: 'API de convite de membros da equipe', summary: 'Produtores poderão convidar pessoas para a equipe por e-mail.', author: 'zelia-k', state: 'open', created: 5, reviewers: ['bento-m'], ini: '102', commits: 3 },
  { repo: 'admin-permissions-svc', n: 85, title: 'Trilha de auditoria para mudanças de permissão', summary: null, author: 'bento-m', state: 'open', created: 1, reviewers: ['iara-v', 'zelia-k'], commits: 2 },
  // incident-gateway
  { repo: 'incident-gateway', n: 301, title: 'Retry com backoff exponencial nas chamadas ao adquirente', summary: 'Falhas momentâneas do adquirente deixam de derrubar pagamentos.', author: 'nilo-q', state: 'merged', created: 16, end: 12, ini: '103', commits: 3 },
  { repo: 'incident-gateway', n: 309, title: 'Corrige timeout em webhooks duplicados', summary: 'Clientes não recebem mais a mesma notificação de pagamento duas vezes.', author: 'maira-t', state: 'merged', created: 5, end: 2, ini: '103', commits: 2 },
  { repo: 'incident-gateway', n: 312, title: 'Circuit breaker para o provedor de antifraude', summary: 'Se o antifraude ficar fora do ar, os pagamentos seguem com análise reduzida.', author: 'tupa-r', state: 'open', created: 2, reviewers: ['maira-t', 'nilo-q'], ini: '103', commits: 2 },
  // payments-reconciler
  { repo: 'payments-reconciler', n: 145, title: 'Conciliação de estornos parciais', summary: 'Estornos parciais passam a aparecer corretamente na conciliação diária.', author: 'nilo-q', state: 'merged', created: 27, end: 21, ini: '103', commits: 3 },
  { repo: 'payments-reconciler', n: 151, title: 'Ignora lançamentos duplicados na conciliação', summary: 'Evita contar duas vezes o mesmo lançamento bancário.', author: 'maira-t', state: 'open', created: 3, commits: 2 },
  { repo: 'payments-reconciler', n: 153, title: 'Corrige fuso horário no fechamento diário', summary: null, author: 'tupa-r', state: 'merged', created: 3, end: 0.8, commits: 2 },
  // forge-ci-templates
  { repo: 'forge-ci-templates', n: 34, title: 'Template único de build e teste', summary: 'Todos os repositórios passam a usar o mesmo roteiro de build e testes.', author: 'caetano-u', state: 'merged', created: 19, end: 14, ini: '104', commits: 3 },
  { repo: 'forge-ci-templates', n: 39, title: 'Cache de dependências nos templates', summary: 'Pipelines ficam mais rápidos ao reaproveitar dependências já baixadas.', author: 'dalva-p', state: 'open', created: 2, reviewers: ['caetano-u', 'anselmo-j'], ini: '104', commits: 2 },
  // design-system
  { repo: 'design-system', n: 260, title: 'Componente de seletor de equipe', summary: 'Novo componente para escolher a equipe ao gerenciar permissões.', author: 'dalva-p', state: 'merged', created: 10, end: 6, ini: '102', commits: 3 },
  { repo: 'design-system', n: 264, title: 'Tokens de cor para modo escuro', summary: 'Prepara as cores do sistema para um futuro modo escuro.', author: 'anselmo-j', state: 'merged', created: 9, end: 4, commits: 2 },
  { repo: 'design-system', n: 268, title: 'Ajustes de acessibilidade no menu lateral', summary: null, author: 'dalva-p', state: 'open', created: 3, commits: 2 },
  // platform-observability
  { repo: 'platform-observability', n: 58, title: 'Painel de latência dos webhooks', summary: null, author: 'anselmo-j', state: 'merged', created: 13, end: 10, commits: 3 },
  { repo: 'platform-observability', n: 61, title: 'Alerta de fila de conciliação acumulada', summary: 'Suporte é avisado antes que a conciliação atrase.', author: 'caetano-u', state: 'merged', created: 6, end: 2, ini: '103', commits: 2 },
];

// [repo#number, reviewer, verdict, days ago]
const REVIEWS: Array<[string, string, ReviewVerdict, number]> = [
  ['admin-console-web#412', 'bento-m', 'commented', 20],
  ['admin-console-web#412', 'bento-m', 'approved', 18.4],
  ['admin-console-web#418', 'iara-v', 'approved', 9.3],
  ['admin-console-web#425', 'iara-v', 'approved', 3.2],
  ['admin-billing-api#208', 'zelia-k', 'changes_requested', 18],
  ['admin-billing-api#208', 'zelia-k', 'approved', 15.4],
  ['admin-billing-api#214', 'iara-v', 'approved', 5.3],
  ['admin-billing-api#217', 'zelia-k', 'approved', 2],
  ['admin-billing-api#219', 'bento-m', 'commented', 12.5],
  ['admin-permissions-svc#77', 'zelia-k', 'approved', 19.5],
  ['admin-permissions-svc#83', 'bento-m', 'changes_requested', 2],
  ['incident-gateway#301', 'maira-t', 'approved', 12.3],
  ['incident-gateway#309', 'tupa-r', 'approved', 2.2],
  ['payments-reconciler#145', 'maira-t', 'approved', 21.4],
  ['payments-reconciler#151', 'tupa-r', 'approved', 1.5],
  ['payments-reconciler#153', 'nilo-q', 'approved', 1.3],
  ['forge-ci-templates#34', 'anselmo-j', 'approved', 14.5],
  ['design-system#260', 'caetano-u', 'approved', 6.4],
  ['design-system#264', 'dalva-p', 'approved', 4.3],
  ['design-system#268', 'caetano-u', 'commented', 1],
  ['platform-observability#58', 'caetano-u', 'approved', 10.3],
  ['platform-observability#61', 'dalva-p', 'approved', 2.4],
];

// [repo#number, pipeline, status, days ago]
const RUNS: Array<[string, string, PipelineStatus, number]> = [
  ['admin-console-web#429', 'ci', 'failure', 1.5], // blocks an open CR
  ['admin-console-web#412', 'ci', 'success', 20],
  ['admin-billing-api#214', 'build-and-test', 'failure', 7], // merged CR head, fails first...
  ['admin-billing-api#214', 'build-and-test', 'success', 6.5], // ...then passes on re-run
  ['incident-gateway#309', 'ci', 'success', 2.5],
  ['payments-reconciler#151', 'lint', 'failure', 2.5],
  ['forge-ci-templates#39', 'build-and-test', 'running', 0.1],
  ['admin-permissions-svc#77', 'ci', 'success', 21],
];

// [environment, status, repo, days ago, included CRs (numbers)]. Newest included CR gives the sha.
const DEPLOYMENTS: Array<[DeploymentEnvironment, DeploymentStatus, string, number, number[]]> = [
  ['production', 'success', 'admin-console-web', 17, [412]],
  ['staging', 'success', 'admin-console-web', 8, [412, 418]], // 418 reaches staging only
  ['production', 'success', 'admin-billing-api', 14, [208]],
  ['staging', 'success', 'admin-billing-api', 4, [208, 214]], // 214 reaches staging only
  ['production', 'success', 'incident-gateway', 11, [301]],
  ['production', 'failure', 'incident-gateway', 1, [309]],
];

// Two old commits in the otherwise silent repo: [days ago, author, message]
const LEGACY_COMMITS: Array<[number, string, string]> = [
  [41, 'nilo-q', 'chore: atualiza dependências de segurança'],
  [55, 'maira-t', 'fix: corrige máscara de CPF no formulário legado'],
];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildDemoSnapshot(now: Date): ForgeSnapshot {
  const ago = (days: number, hours = 0): string =>
    new Date(now.getTime() - (days * 24 + hours) * 3_600_000).toISOString();
  const crKeyToId = (key: string) => {
    const [repo, n] = key.split('#');
    return crId(repo, Number(n));
  };

  const repoUrl = (repo: string) => `${BASE_URL}/${repo}`;
  const defaultBranch = (repo: string) => (repo === 'legacy-checkout' ? 'master' : 'main');

  const repositories: Repository[] = REPOS.map(([name, squadId, language, description]) => ({
    id: repoId(name),
    squadId,
    name,
    fullName: `voomp-demo/${name}`,
    description,
    defaultBranch: defaultBranch(name),
    language,
    webUrl: repoUrl(name),
  }));

  const contributors: Contributor[] = PEOPLE.map(([handle, displayName, squadId, role]) => ({
    id: ctId(handle),
    displayName,
    handle,
    squadId,
    role,
  }));

  // Commits are spread evenly between the CR's creation and its end (merge, close or now).
  const commits: Commit[] = [];
  const headShas = new Map<string, string>();
  const mergeShas = new Map<string, string>();
  const commitPrefixes = ['feat', 'test', 'fix'];

  const changeRequests: ChangeRequest[] = CRS.map((row, index) => {
    const id = crId(row.repo, row.n);
    const created = now.getTime() - row.created * 86_400_000;
    const end = row.end !== undefined ? now.getTime() - row.end * 86_400_000 : now.getTime();
    for (let k = 1; k <= row.commits; k++) {
      const commitSha = sha(`${id}:commit:${k}`);
      commits.push({
        sha: commitSha,
        repositoryId: repoId(row.repo),
        authorId: ctId(row.author),
        message: `${commitPrefixes[k - 1]}: ${row.title.toLowerCase()}`,
        committedAt: new Date(created + ((end - created) * k) / (row.commits + 1)).toISOString(),
        changeRequestId: id,
        webUrl: `${repoUrl(row.repo)}/commit/${commitSha}`,
      });
      if (k === row.commits) headShas.set(id, commitSha);
    }

    const merged = row.state === 'merged';
    let mergeCommitSha: string | null = null;
    if (merged) {
      mergeCommitSha = sha(`${id}:merge`);
      mergeShas.set(id, mergeCommitSha);
      commits.push({
        sha: mergeCommitSha,
        repositoryId: repoId(row.repo),
        authorId: ctId(row.author),
        message: `Merge #${row.n}: ${row.title}`,
        committedAt: ago(row.end!),
        changeRequestId: id,
        webUrl: `${repoUrl(row.repo)}/commit/${mergeCommitSha}`,
      });
    }

    return {
      origin: 'provider',
      id,
      number: row.n,
      repositoryId: repoId(row.repo),
      title: row.title,
      productSummary: row.summary,
      authorId: ctId(row.author),
      state: row.state,
      draft: row.draft ?? false,
      createdAt: ago(row.created),
      mergedAt: merged ? ago(row.end!) : null,
      closedAt: row.end !== undefined ? ago(row.end) : null,
      headSha: headShas.get(id)!,
      mergeCommitSha,
      targetBranch: defaultBranch(row.repo),
      requestedReviewerIds: (row.reviewers ?? []).map(ctId),
      initiativeId: row.ini ? INI[row.ini] : null,
      workItems: taskRefs(squadOf(row.repo), index),
      webUrl: `${repoUrl(row.repo)}/changes/${row.n}`,
    };
  });

  // Old commits of the inactive repo.
  for (const [days, author, message] of LEGACY_COMMITS) {
    const commitSha = sha(`legacy-checkout:${days}`);
    commits.push({
      sha: commitSha,
      repositoryId: repoId('legacy-checkout'),
      authorId: ctId(author),
      message,
      committedAt: ago(days),
      changeRequestId: null,
      webUrl: `${repoUrl('legacy-checkout')}/commit/${commitSha}`,
    });
  }

  const reviews: Review[] = REVIEWS.map(([key, reviewer, verdict, days], i) => ({
    id: `rv-${i + 1}`,
    changeRequestId: crKeyToId(key),
    reviewerId: ctId(reviewer),
    verdict,
    submittedAt: ago(days),
  }));

  const pipelineRuns: PipelineRun[] = RUNS.map(([key, pipelineName, status, days], i) => {
    const id = `run-${i + 1}`;
    const cr = changeRequests.find((c) => c.id === crKeyToId(key))!;
    const repo = key.split('#')[0];
    return {
      id,
      repositoryId: repoId(repo),
      pipelineName,
      headSha: cr.headSha,
      branch: `change-${cr.number}`,
      changeRequestId: cr.id,
      status,
      startedAt: ago(days),
      webUrl: `${repoUrl(repo)}/pipelines/${id}`,
    };
  });

  const deployments: Deployment[] = DEPLOYMENTS.map(([environment, status, repo, days, numbers], i) => {
    const id = `dep-${i + 1}`;
    const ids = numbers.map((n) => crId(repo, n));
    return {
      id,
      repositoryId: repoId(repo),
      environment,
      sha: mergeShas.get(ids[ids.length - 1])!,
      ref: 'main',
      createdAt: ago(days),
      status,
      changeRequestIds: ids,
      webUrl: `${repoUrl(repo)}/deployments/${id}`,
    };
  });

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    source: {
      kind: 'demo',
      provider: {
        id: 'demo',
        name: 'Demo',
        vocabulary: { changeRequest: 'Pull request', changeRequestShort: 'PR', pipeline: 'Pipeline' },
      },
      capabilities: { changeRequests: 'native', reviews: 'native', pipelines: 'native', deployments: 'native', documents: 'native' },
      generatedAt: now.toISOString(),
    },
    organization: { id: 'org-voomp-demo', name: 'Voomp (Demo)', slug: 'voomp-demo' },
    squads: SQUADS,
    repositories,
    contributors,
    changeRequests,
    reviews,
    commits,
    pipelineRuns,
    deployments,
    initiatives: INITIATIVES,
    documents: DOCS.map(([id, title, kind, space, squadId, initiativeIds, repos, days]) => ({
      id,
      title,
      kind,
      space,
      squadId,
      initiativeIds,
      repositoryIds: repos.map(repoId),
      updatedAt: ago(days),
      webUrl: `https://wiki.demo.voomp.invalid/${space.toLowerCase()}/${id}`,
    })),
  };
}

/** Quick counts of a snapshot, handy for tests and debugging. */
export function describeDemoSnapshot(s: ForgeSnapshot) {
  return {
    squads: s.squads.length,
    repositories: s.repositories.length,
    contributors: s.contributors.length,
    changeRequests: s.changeRequests.length,
    merged: s.changeRequests.filter((c) => c.state === 'merged').length,
    open: s.changeRequests.filter((c) => c.state === 'open').length,
    closed: s.changeRequests.filter((c) => c.state === 'closed').length,
    reviews: s.reviews.length,
    commits: s.commits.length,
    pipelineRuns: s.pipelineRuns.length,
    deployments: s.deployments.length,
    initiatives: s.initiatives.length,
  };
}
