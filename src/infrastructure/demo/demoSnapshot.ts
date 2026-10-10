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
  StaffAssignment,
  WorkItem,
  WorkItemStatus,
  WorkItemType,
  Workstream,
} from '@domain/entities';
import { SNAPSHOT_SCHEMA_VERSION } from '@domain/entities';

const BASE_URL = 'https://git.demo.lanterna.invalid/lanterna-norte';

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
  { id: 'sq-admin',  code: 'E', name: 'Experience',     description: 'Telas web, fluxos de usuário e o console do produto.' },
  { id: 'sq-n3',     code: 'R', name: 'Reliability',    description: 'Incidentes, sinais de falha e correções em produção.' },
  { id: 'sq-enable', code: 'P', name: 'Platform',       description: 'CI, design system e ferramentas compartilhadas.' },
  { id: 'sq-vmpg',   code: 'N', name: 'Integrations',   description: 'APIs de parceiros, contratos de evento e conectores.' },
  { id: 'sq-vgfe',   code: 'D', name: 'Data',           description: 'Pipelines, modelos analíticos e catálogos de dados.' },
  { id: 'sq-vgat',   code: 'M', name: 'Messaging',      description: 'Filas, notificações e contratos entre serviços.' },
  { id: 'sq-vply',   code: 'K', name: 'Discovery',      description: 'Busca, cadastro de itens e a vitrine do produto.' },
];

// [name, squad, language, description]
const REPOS: Array<[string, string, string, string]> = [
  ['bancada-web', 'sq-admin', 'TypeScript', 'Painel da bancada para pedidos, fichas e a agenda do dia.'],
  ['fichas-api', 'sq-admin', 'TypeScript', 'API das fichas de serviço, prazos e peças usadas.'],
  ['crachas-svc', 'sq-admin', 'Go', 'Serviço de crachás e o que cada bancada pode abrir.'],
  ['plantao-ponte', 'sq-n3', 'Go', 'Ponte que isola uma bancada quando o sinal de rádio cai.'],
  ['pecas-conferencia', 'sq-n3', 'Kotlin', 'Conferência diária entre peças pedidas, usadas e devolvidas.'],
  ['catalogo-antigo', 'sq-n3', 'PHP', 'Catálogo antigo de modelos, mantido apenas para consulta.'],
  ['forge-ci-templates', 'sq-enable', 'YAML', 'Templates compartilhados de pipeline de integração contínua.'],
  ['design-system', 'sq-enable', 'TypeScript', 'Biblioteca de componentes e tokens visuais usada pelos produtos.'],
  ['sinais-plataforma', 'sq-enable', 'Go', 'Coletores, painéis e alertas dos sinais da oficina.'],
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
  { id: 'ini-financial-panel', key: 'INI-101', name: 'Quadro de pedidos da bancada', summary: 'Mostrar pedidos abertos, peças e prazos da oficina em um só quadro.', ownerSquadId: 'sq-admin', status: 'in_delivery' },
  { id: 'ini-team-permissions', key: 'INI-102', name: 'Permissões por equipe', summary: 'Permitir que a oficina convide bancadas e controle o que cada crachá abre.', ownerSquadId: 'sq-admin', status: 'in_delivery' },
  { id: 'ini-payment-stability', key: 'INI-103', name: 'Estabilidade do plantão', summary: 'Reduzir falhas e divergências entre peças pedidas e peças usadas.', ownerSquadId: 'sq-n3', status: 'in_delivery' },
  { id: 'ini-unified-ci', key: 'INI-104', name: 'Pipeline unificado de CI', summary: 'Padronizar a integração contínua em todos os repositórios.', ownerSquadId: 'sq-enable', status: 'discovery' },
];
// Knowledge base pages: [id, title, kind, space, squad, initiatives, repos, updated days ago]
const DOCS: Array<[string, string, DocumentKind, string, string | null, string[], string[], number]> = [
  ['doc-fin-spec', 'Especificação: quadro de pedidos da bancada', 'spec', 'Produto', 'sq-admin', ['ini-financial-panel'], ['bancada-web', 'fichas-api'], 9],
  ['doc-fin-adr', 'ADR-014: prazo calculado na ficha, não no quadro', 'adr', 'ENG', 'sq-admin', ['ini-financial-panel'], ['fichas-api'], 20],
  ['doc-perm-spec', 'Especificação: permissões por equipe', 'spec', 'Produto', 'sq-admin', ['ini-team-permissions'], ['crachas-svc', 'design-system'], 6],
  ['doc-perm-adr', 'ADR-017: modelo de papéis baseado em políticas', 'adr', 'ENG', 'sq-admin', ['ini-team-permissions'], ['crachas-svc'], 15],
  ['doc-pay-runbook', 'Runbook: falha do adquirente', 'runbook', 'Operação', 'sq-n3', ['ini-payment-stability'], ['plantao-ponte'], 4],
  ['doc-pay-pm', 'Post-mortem: divergência na conferência de setembro', 'postmortem', 'Operação', 'sq-n3', ['ini-payment-stability'], ['pecas-conferencia'], 11],
  ['doc-legacy-guide', 'Guia: catálogo antigo só para consulta', 'guide', 'Operação', 'sq-n3', [], ['catalogo-antigo'], 52],
  ['doc-ci-adr', 'ADR-021: templates únicos de pipeline', 'adr', 'Plataforma', 'sq-enable', ['ini-unified-ci'], ['forge-ci-templates'], 8],
  ['doc-ds-guide', 'Guia de contribuição do design system', 'guide', 'Plataforma', 'sq-enable', [], ['design-system'], 26],
  ['doc-obs-runbook', 'Runbook: alertas de latência', 'runbook', 'Plataforma', 'sq-enable', [], ['sinais-plataforma'], 13],
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
  return [{ key, url: `https://tracker.demo.lanterna.invalid/browse/${key}` }];
};

const CRS: CrRow[] = [
  // bancada-web
  { repo: 'bancada-web', n: 412, title: 'Adiciona a lista de peças entregues ao quadro', summary: 'A bancada passa a ver cada peça entregue, com data e quantidade.', author: 'zelia-k', state: 'merged', created: 22, end: 18, ini: '101', commits: 3 },
  { repo: 'bancada-web', n: 418, title: 'Filtro por período na agenda de serviços', summary: 'A agenda pode ser filtrada por semana, mês ou datas escolhidas.', author: 'bento-m', state: 'merged', created: 12, end: 9, ini: '101', commits: 2 },
  { repo: 'bancada-web', n: 425, title: 'Corrige paginação da lista de clientes da oficina', summary: 'A lista de clientes não pula mais fichas ao trocar de página.', author: 'zelia-k', state: 'merged', created: 6, end: 3, commits: 2 },
  { repo: 'bancada-web', n: 429, title: 'Gráfico de serviços concluídos no mês', summary: 'Novo gráfico mostra quantos serviços a oficina conclui mês a mês.', author: 'zelia-k', state: 'open', created: 2, reviewers: ['bento-m', 'iara-v'], ini: '101', commits: 3 },
  { repo: 'bancada-web', n: 431, title: 'Rascunho: exportação CSV das peças', summary: 'Permite baixar as peças em planilha. Ainda em construção.', author: 'bento-m', state: 'open', draft: true, created: 1, ini: '101', commits: 2 },
  // fichas-api
  { repo: 'fichas-api', n: 208, title: 'Endpoint de peças disponíveis na prateleira', summary: 'O quadro consegue mostrar quantas peças a bancada pode retirar agora.', author: 'iara-v', state: 'merged', created: 20, end: 15, ini: '101', commits: 3 },
  { repo: 'fichas-api', n: 214, title: 'Ajusta a contagem de parafusos na ficha', summary: 'A contagem deixa de divergir entre a ficha e a prateleira.', author: 'zelia-k', state: 'merged', created: 8, end: 5, commits: 2 },
  { repo: 'fichas-api', n: 217, title: 'Rateio de horas por bancada parceira', summary: 'As horas de cada bancada parceira entram automaticamente em cada serviço.', author: 'iara-v', state: 'open', created: 4, ini: '101', commits: 3 },
  { repo: 'fichas-api', n: 219, title: 'Cache da ficha por cliente (substituída por #217)', summary: 'Tentativa de acelerar o extrato; descartada em favor de outra abordagem.', author: 'zelia-k', state: 'closed', created: 14, end: 11, commits: 2 },
  // crachas-svc
  { repo: 'crachas-svc', n: 77, title: 'Modelo de papéis por equipe', summary: 'Define os crachás (chefe de bancada, almoxarife, plantão) que uma equipe pode ter.', author: 'iara-v', state: 'merged', created: 25, end: 19, ini: '102', commits: 3 },
  { repo: 'crachas-svc', n: 83, title: 'API de convite de membros da equipe', summary: 'A oficina poderá convidar pessoas para a bancada por e-mail.', author: 'zelia-k', state: 'open', created: 5, reviewers: ['bento-m'], ini: '102', commits: 3 },
  { repo: 'crachas-svc', n: 85, title: 'Trilha de auditoria para mudanças de permissão', summary: null, author: 'bento-m', state: 'open', created: 1, reviewers: ['iara-v', 'zelia-k'], commits: 2 },
  // plantao-ponte
  { repo: 'plantao-ponte', n: 301, title: 'Nova tentativa com espera crescente nas chamadas ao rádio', summary: 'Falhas momentâneas do rádio deixam de derrubar o plantão.', author: 'nilo-q', state: 'merged', created: 16, end: 12, ini: '103', commits: 3 },
  { repo: 'plantao-ponte', n: 309, title: 'Corrige aviso duplicado no rádio', summary: 'A bancada não recebe mais o mesmo aviso duas vezes.', author: 'maira-t', state: 'merged', created: 5, end: 2, ini: '103', commits: 2 },
  { repo: 'plantao-ponte', n: 312, title: 'Corte de sinal quando o rádio auxiliar cai', summary: 'Se o rádio auxiliar cair, o plantão segue com o canal principal.', author: 'tupa-r', state: 'open', created: 2, reviewers: ['maira-t', 'nilo-q'], ini: '103', commits: 2 },
  // pecas-conferencia
  { repo: 'pecas-conferencia', n: 145, title: 'Conferência de devoluções parciais', summary: 'Devoluções parciais passam a aparecer na conferência diária.', author: 'nilo-q', state: 'merged', created: 27, end: 21, ini: '103', commits: 3 },
  { repo: 'pecas-conferencia', n: 151, title: 'Ignora peças contadas duas vezes', summary: 'Evita contar duas vezes a mesma peça.', author: 'maira-t', state: 'open', created: 3, commits: 2 },
  { repo: 'pecas-conferencia', n: 153, title: 'Corrige fuso horário no fechamento diário', summary: null, author: 'tupa-r', state: 'merged', created: 3, end: 0.8, commits: 2 },
  // forge-ci-templates
  { repo: 'forge-ci-templates', n: 34, title: 'Template único de build e teste', summary: 'Todos os repositórios passam a usar o mesmo roteiro de build e testes.', author: 'caetano-u', state: 'merged', created: 19, end: 14, ini: '104', commits: 3 },
  { repo: 'forge-ci-templates', n: 39, title: 'Cache de dependências nos templates', summary: 'Pipelines ficam mais rápidos ao reaproveitar dependências já baixadas.', author: 'dalva-p', state: 'open', created: 2, reviewers: ['caetano-u', 'anselmo-j'], ini: '104', commits: 2 },
  // design-system
  { repo: 'design-system', n: 260, title: 'Componente de seletor de equipe', summary: 'Novo componente para escolher a equipe ao gerenciar permissões.', author: 'dalva-p', state: 'merged', created: 10, end: 6, ini: '102', commits: 3 },
  { repo: 'design-system', n: 264, title: 'Tokens de cor para modo escuro', summary: 'Prepara as cores do sistema para um futuro modo escuro.', author: 'anselmo-j', state: 'merged', created: 9, end: 4, commits: 2 },
  { repo: 'design-system', n: 268, title: 'Ajustes de acessibilidade no menu lateral', summary: null, author: 'dalva-p', state: 'open', created: 3, commits: 2 },
  // sinais-plataforma
  { repo: 'sinais-plataforma', n: 58, title: 'Painel de latência dos webhooks', summary: null, author: 'anselmo-j', state: 'merged', created: 13, end: 10, commits: 3 },
  { repo: 'sinais-plataforma', n: 61, title: 'Alerta de fila de conferência acumulada', summary: 'O plantão é avisado antes que a conferência atrase.', author: 'caetano-u', state: 'merged', created: 6, end: 2, ini: '103', commits: 2 },
];

// [repo#number, reviewer, verdict, days ago]
const REVIEWS: Array<[string, string, ReviewVerdict, number]> = [
  ['bancada-web#412', 'bento-m', 'commented', 20],
  ['bancada-web#412', 'bento-m', 'approved', 18.4],
  ['bancada-web#418', 'iara-v', 'approved', 9.3],
  ['bancada-web#425', 'iara-v', 'approved', 3.2],
  ['fichas-api#208', 'zelia-k', 'changes_requested', 18],
  ['fichas-api#208', 'zelia-k', 'approved', 15.4],
  ['fichas-api#214', 'iara-v', 'approved', 5.3],
  ['fichas-api#217', 'zelia-k', 'approved', 2],
  ['fichas-api#219', 'bento-m', 'commented', 12.5],
  ['crachas-svc#77', 'zelia-k', 'approved', 19.5],
  ['crachas-svc#83', 'bento-m', 'changes_requested', 2],
  ['plantao-ponte#301', 'maira-t', 'approved', 12.3],
  ['plantao-ponte#309', 'tupa-r', 'approved', 2.2],
  ['pecas-conferencia#145', 'maira-t', 'approved', 21.4],
  ['pecas-conferencia#151', 'tupa-r', 'approved', 1.5],
  ['pecas-conferencia#153', 'nilo-q', 'approved', 1.3],
  ['forge-ci-templates#34', 'anselmo-j', 'approved', 14.5],
  ['design-system#260', 'caetano-u', 'approved', 6.4],
  ['design-system#264', 'dalva-p', 'approved', 4.3],
  ['design-system#268', 'caetano-u', 'commented', 1],
  ['sinais-plataforma#58', 'caetano-u', 'approved', 10.3],
  ['sinais-plataforma#61', 'dalva-p', 'approved', 2.4],
];

// [repo#number, pipeline, status, days ago]
const RUNS: Array<[string, string, PipelineStatus, number]> = [
  ['bancada-web#429', 'ci', 'failure', 1.5], // blocks an open CR
  ['bancada-web#412', 'ci', 'success', 20],
  ['fichas-api#214', 'build-and-test', 'failure', 7], // merged CR head, fails first...
  ['fichas-api#214', 'build-and-test', 'success', 6.5], // ...then passes on re-run
  ['plantao-ponte#309', 'ci', 'success', 2.5],
  ['pecas-conferencia#151', 'lint', 'failure', 2.5],
  ['forge-ci-templates#39', 'build-and-test', 'running', 0.1],
  ['crachas-svc#77', 'ci', 'success', 21],
];

// [environment, status, repo, days ago, included CRs (numbers)]. Newest included CR gives the sha.
const DEPLOYMENTS: Array<[DeploymentEnvironment, DeploymentStatus, string, number, number[]]> = [
  ['production', 'success', 'bancada-web', 17, [412]],
  ['staging', 'success', 'bancada-web', 8, [412, 418]], // 418 reaches staging only
  ['production', 'success', 'fichas-api', 14, [208]],
  ['staging', 'success', 'fichas-api', 4, [208, 214]], // 214 reaches staging only
  ['production', 'success', 'plantao-ponte', 11, [301]],
  ['production', 'failure', 'plantao-ponte', 1, [309]],
  ['production', 'running', 'bancada-web', 20 / 1440, [418]], // in flight right now (20 min ago)
];

// Two old commits in the otherwise silent repo: [days ago, author, message]
const LEGACY_COMMITS: Array<[number, string, string]> = [
  [41, 'nilo-q', 'chore: atualiza dependências de segurança'],
  [55, 'maira-t', 'fix: corrige máscara do número de série no formulário antigo'],
];


// ---------------------------------------------------------------------------
// Tracker issues (epics, stories derived from the change requests, extras)
// ---------------------------------------------------------------------------

const TRACKER_URL = 'https://tracker.demo.lanterna.invalid/browse';

// [key, title, sprint]
const EPICS: Array<[string, string]> = [
  ['ADM-100', 'Quadro de pedidos da bancada'],
  ['ADM-110', 'Permissões por equipe'],
  ['ADM-120', 'Retirada antecipada de peças'],
  ['ADM-130', 'Cadastro do cliente da oficina'],
  ['SUS-200', 'Estabilidade da ponte de rádio'],
  ['SUS-210', 'Conferência e fechamento diário'],
  ['SUS-220', 'Nova tentativa de avisos que falharam'],
  ['SUS-240', 'Fichas abertas sem dono'],
  ['SUS-260', 'Conferência: melhorias de backlog'],
  ['ENB-300', 'Pipeline unificado de CI'],
  ['ENB-310', 'Evolução do design system'],
  ['ENB-320', 'Observabilidade da plataforma'],
  ['ENB-330', 'Minhas lanternas'],
];

/** Epic of each change request: explicit overrides first, then by repository. */
const CR_EPIC_BY_REPO: Record<string, string> = {
  'bancada-web': 'ADM-100',
  'fichas-api': 'ADM-120',
  'crachas-svc': 'ADM-110',
  'plantao-ponte': 'SUS-200',
  'pecas-conferencia': 'SUS-210',
  'forge-ci-templates': 'ENB-300',
  'design-system': 'ENB-310',
  'sinais-plataforma': 'ENB-320',
  'catalogo-antigo': 'SUS-200',
};
const CR_EPIC_OVERRIDE: Record<string, string> = {
  'plantao-ponte#301': 'SUS-220',
  'pecas-conferencia#151': 'SUS-260',
  'design-system#260': 'ADM-110',
};
/** The tracker says "em produção" for this change although Git only saw it in staging (divergence demo). */
const TRACKER_AHEAD_OF_GIT = new Set(['fichas-api#214']);

// Extra stories with no change request yet: [key, title, type, epic, status, statusName, sprint, productionDaysAgo]
type Extra = [string, string, WorkItemType, string, WorkItemStatus, string, string | null, number | null];
const EXTRA_ITEMS: Extra[] = [
  ['ADM-401', 'Simulador de prazo da retirada antecipada', 'story', 'ADM-120', 'todo', 'A fazer', 'Sprint 6', null],
  ['ADM-402', 'Confirmação de retirada com código enviado por e-mail', 'story', 'ADM-120', 'in_progress', 'Em desenvolvimento', 'Sprint 6', null],
  ['ADM-403', 'Estado vazio do quadro para oficina sem pedidos', 'story', 'ADM-100', 'todo', 'A fazer', 'Sprint 6', null],
  ['ADM-404', 'Documentar a contagem de peças para o plantão', 'task', 'ADM-100', 'done', 'Concluído', 'Sprint 5', null],
  ['ADM-410', 'Envio da foto da lanterna (frente e verso)', 'story', 'ADM-130', 'in_progress', 'Em desenvolvimento', 'Sprint 6', null],
  ['ADM-411', 'Integração com o arquivo de modelos da oficina', 'story', 'ADM-130', 'in_progress', 'Em desenvolvimento', 'Sprint 6', null],
  ['ADM-412', 'Fluxo de foto recusada e novo envio', 'story', 'ADM-130', 'todo', 'A fazer', null, null],
  ['ADM-413', 'Foto rejeitada em aparelhos Android antigos', 'bug', 'ADM-130', 'todo', 'A fazer', 'Sprint 6', null],
  ['SUS-401', 'Fila de novas tentativas para avisos que falharam', 'story', 'SUS-220', 'done', 'Em produção', 'Sprint 5', 12],
  ['SUS-402', 'Regras de intervalo entre novas tentativas', 'story', 'SUS-220', 'done', 'Em produção', 'Sprint 5', 12],
  ['SUS-410', 'Regras para fichas abertas sem dono', 'story', 'SUS-240', 'todo', 'A fazer', null, null],
  ['SUS-411', 'Levantamento de devoluções do último trimestre', 'task', 'SUS-240', 'todo', 'A fazer', 'Sprint 6', null],
  ['ENB-401', 'Listagem de lanternas do cliente', 'story', 'ENB-330', 'done', 'Em produção', 'Sprint 5', 6],
  ['ENB-402', 'Detalhe da lanterna e acesso à ficha', 'story', 'ENB-330', 'done', 'Em produção', 'Sprint 5', 6],
  ['ENB-403', 'Segunda via do comprovante de retirada', 'story', 'ENB-330', 'done', 'Em produção', 'Sprint 6', 5],
];

// Display-only names (no contributor record): N2 / support staff from the planning sheet.
const N2_NAMES = ['Letícia Aracati', 'Murilo Cajueiro', 'Sabrina Guaporé', 'Ícaro Tabatinga'];

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
  const defaultBranch = (repo: string) => (repo === 'catalogo-antigo' ? 'master' : 'main');

  const repositories: Repository[] = REPOS.map(([name, squadId, language, description]) => ({
    id: repoId(name),
    squadId,
    name,
    fullName: `lanterna-norte/${name}`,
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
    const commitSha = sha(`catalogo-antigo:${days}`);
    commits.push({
      sha: commitSha,
      repositoryId: repoId('catalogo-antigo'),
      authorId: ctId(author),
      message,
      committedAt: ago(days),
      changeRequestId: null,
      webUrl: `${repoUrl('catalogo-antigo')}/commit/${commitSha}`,
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
      triggeredById: changeRequests.find((c) => c.id === ids[ids.length - 1])?.authorId ?? null,
      webUrl: `${repoUrl(repo)}/deployments/${id}`,
    };
  });


  // ---- Tracker issues ------------------------------------------------------
  const productionAtByCr = new Map<string, string>();
  for (const d of deployments) {
    if (d.environment !== 'production' || d.status !== 'success') continue;
    for (const id of d.changeRequestIds) {
      const prev = productionAtByCr.get(id);
      if (!prev || d.createdAt > prev) productionAtByCr.set(id, d.createdAt);
    }
  }
  const reposWithDeploys = new Set(deployments.map((d) => d.repositoryId));
  const itemUrl = (key: string) => `${TRACKER_URL}/${key}`;
  const workItems: WorkItem[] = EPICS.map(([key, title]) => ({
    key,
    title,
    type: 'epic' as const,
    status: 'in_progress' as const,
    statusName: 'Em andamento',
    epicKey: null,
    sprint: null,
    updatedAt: ago(1),
    productionAt: null,
    url: itemUrl(key),
  }));
  changeRequests.forEach((cr, index) => {
    const ref = cr.workItems[0];
    if (!ref) return;
    const row = CRS[index];
    const crKey = `${row.repo}#${row.n}`;
    const prodAt = productionAtByCr.get(cr.id) ?? null;
    let status: WorkItemStatus;
    let statusName: string;
    let productionAt: string | null = null;
    if (prodAt) {
      status = 'done';
      statusName = 'Em produção';
      productionAt = prodAt;
    } else if (cr.state === 'merged') {
      const hasDeploys = reposWithDeploys.has(cr.repositoryId);
      status = hasDeploys && !TRACKER_AHEAD_OF_GIT.has(crKey) ? 'in_progress' : 'done';
      statusName = TRACKER_AHEAD_OF_GIT.has(crKey) ? 'Em produção' : hasDeploys ? 'Aguardando deploy' : 'Concluído';
      if (TRACKER_AHEAD_OF_GIT.has(crKey)) productionAt = ago(2);
    } else if (cr.state === 'closed') {
      status = 'todo';
      statusName = 'Backlog';
    } else if (cr.draft) {
      status = 'todo';
      statusName = 'A fazer';
    } else {
      status = 'in_progress';
      statusName = 'Em revisão';
    }
    workItems.push({
      key: ref.key,
      title: row.title.replace(/^Rascunho: /, '').replace(/ \(substituída.*\)$/, ''),
      type: /^Corrige/.test(row.title) ? 'bug' : 'story',
      status,
      statusName,
      epicKey: CR_EPIC_OVERRIDE[crKey] ?? CR_EPIC_BY_REPO[row.repo] ?? null,
      sprint: row.created >= 14 ? 'Sprint 5' : 'Sprint 6',
      updatedAt: ago(row.end ?? Math.max(0, row.created - 1)),
      productionAt,
      url: ref.url,
    });
  });
  for (const [key, title, type, epicKey, status, statusName, sprint, prodDays] of EXTRA_ITEMS) {
    workItems.push({
      key,
      title,
      type,
      status,
      statusName,
      epicKey,
      sprint,
      updatedAt: ago(prodDays ?? 2),
      productionAt: prodDays !== null ? ago(prodDays) : null,
      url: itemUrl(key),
    });
  }

  // ---- Workstreams (fronts of the planning sheet) ---------------------------
  const wiki = (slug: string) => `https://wiki.demo.lanterna.invalid/planejamento/${slug}`;
  const person = (handle: string, role: StaffAssignment['role'], specialty: string | null = null): StaffAssignment => ({
    role,
    personId: ctId(handle),
    displayName: PEOPLE.find(([h]) => h === handle)![1],
    specialty,
  });
  const n2 = (i: number): StaffAssignment => ({ role: 'n2', personId: null, displayName: N2_NAMES[i], specialty: 'apoio' });
  const plan = (label: string, targetDays: number | null, recordedDaysAgo: number) => ({
    label,
    target: targetDays === null ? null : ago(-targetDays),
    recordedAt: ago(recordedDaysAgo),
  });
  const links = (slug: string, epic: string) => [
    { label: 'Planejamento (wiki)', url: wiki(slug) },
    { label: `Épico ${epic}`, url: itemUrl(epic) },
  ];

  const workstreams: Workstream[] = [
    {
      id: 'ws-painel-financeiro',
      name: 'Quadro de pedidos da bancada',
      category: 'sprint_priority',
      squadIds: ['sq-admin'],
      initiativeId: 'ini-financial-panel',
      repositoryIds: [repoId('bancada-web')],
      epicKeys: ['ADM-100'],
      team: [person('iara-v', 'tl'), person('zelia-k', 'dev', 'fullstack'), person('bento-m', 'dev', 'front'), person('maira-t', 'qa'), person('otavio-b', 'pm')],
      plans: [plan('MVP Semana 2 - quinta', 4, 12)],
      dependencies: [],
      declaredDone: false,
      links: links('painel-financeiro', 'ADM-100'),
      notes: ['O gráfico de serviços depende da correção do trilho de build.'],
    },
    {
      id: 'ws-retirada-pecas',
      name: 'Tela de retirada antecipada',
      category: 'sprint_priority',
      squadIds: ['sq-admin', 'sq-enable'],
      initiativeId: 'ini-financial-panel',
      repositoryIds: [repoId('fichas-api'), repoId('design-system')],
      epicKeys: ['ADM-120'],
      team: [person('iara-v', 'tl'), person('zelia-k', 'dev', 'back'), person('dalva-p', 'dev', 'front'), person('nilo-q', 'qa'), person('jandira-f', 'pm')],
      plans: [plan('MVP Semana 2 - quinta', -6, 20), plan('Semana 3', -2, 8)],
      dependencies: [],
      declaredDone: false,
      links: links('retirada-antecipada', 'ADM-120'),
      notes: ['O quadro marca a contagem de parafusos como pronta, mas o Git só viu na bancada de teste.'],
    },
    {
      id: 'ws-verificacao-identidade',
      name: 'Rollout do cadastro de clientes',
      category: 'sprint_priority',
      squadIds: ['sq-admin', 'sq-n3'],
      initiativeId: null,
      repositoryIds: [],
      epicKeys: ['ADM-130'],
      team: [person('iara-v', 'tl'), person('zelia-k', 'dev', 'fullstack'), person('tupa-r', 'dev', 'back'), person('maira-t', 'qa'), person('otavio-b', 'pm'), n2(0)],
      plans: [plan('Semana 3', 9, 15), plan('Semana 4', 16, 3)],
      dependencies: [{ description: 'Dependência de infraestrutura (SRE)', kind: 'blocker' }],
      declaredDone: false,
      links: links('cadastro-clientes', 'ADM-130'),
      notes: ['Ambiente de homologação do provedor depende do time de SRE.'],
    },
    {
      id: 'ws-gateway-v2',
      name: 'Fechamento: migração da ponte v2',
      category: 'closing',
      squadIds: ['sq-n3'],
      initiativeId: null,
      repositoryIds: [repoId('plantao-ponte')],
      epicKeys: ['SUS-200'],
      team: [person('tupa-r', 'tl'), person('nilo-q', 'dev', 'back'), person('maira-t', 'dev', 'back'), person('oriana-c', 'pm'), n2(1)],
      plans: [plan('Semana 2 - sexta', -4, 18)],
      dependencies: [],
      declaredDone: true,
      links: links('ponte-v2', 'SUS-200'),
      notes: ['Planilha marca como finalizado, porém a última publicação em produção falhou.'],
    },
    {
      id: 'ws-retentativa-cobrancas',
      name: 'Nova tentativa de avisos',
      category: 'closing',
      squadIds: ['sq-n3'],
      initiativeId: null,
      repositoryIds: [repoId('plantao-ponte')],
      epicKeys: ['SUS-220'],
      team: [person('tupa-r', 'tl'), person('nilo-q', 'dev', 'back'), person('maira-t', 'qa'), person('oriana-c', 'pm')],
      plans: [plan('MVP Semana 2 - quinta', -8, 22)],
      dependencies: [],
      declaredDone: true,
      links: links('nova-tentativa-avisos', 'SUS-220'),
      notes: [],
    },
    {
      id: 'ws-sustentacao-n3',
      name: 'Reliability operations',
      category: 'sustaining',
      squadIds: ['sq-n3'],
      initiativeId: 'ini-payment-stability',
      repositoryIds: [repoId('pecas-conferencia'), repoId('catalogo-antigo')],
      epicKeys: ['SUS-210'],
      team: [person('tupa-r', 'tl'), person('nilo-q', 'dev', 'back'), person('maira-t', 'dev', 'back'), person('oriana-c', 'pm'), n2(2), n2(3)],
      plans: [plan('Sob demanda', null, 30)],
      dependencies: [{ description: 'Aguardando retorno da consultoria', kind: 'waiting' }],
      declaredDone: false,
      links: links('plantao-farol', 'SUS-210'),
      notes: ['Chamados entram pelo balcão e são triados diariamente.'],
    },
    {
      id: 'ws-fichas-sem-dono',
      name: 'Tema aberto: fichas sem dono',
      category: 'open_topic',
      squadIds: ['sq-n3'],
      initiativeId: null,
      repositoryIds: [],
      epicKeys: ['SUS-240'],
      team: [person('tupa-r', 'tl'), person('oriana-c', 'pm'), n2(2)],
      plans: [plan('Sob demanda', null, 10)],
      dependencies: [],
      declaredDone: false,
      links: links('fichas-sem-dono', 'SUS-240'),
      notes: ['Ainda em levantamento; sem data comprometida.'],
    },
    {
      id: 'ws-minhas-compras',
      name: 'Minhas lanternas',
      category: 'open_topic',
      squadIds: ['sq-enable'],
      initiativeId: null,
      repositoryIds: [],
      epicKeys: ['ENB-330'],
      team: [person('caetano-u', 'tl'), person('anselmo-j', 'dev', 'front'), person('dalva-p', 'dev', 'fullstack'), person('jandira-f', 'pm')],
      plans: [plan('Sob demanda', null, 40), plan('Semana 3', -9, 25), plan('Semana 4', -4, 12)],
      dependencies: [],
      declaredDone: true,
      links: links('minhas-lanternas', 'ENB-330'),
      notes: [],
    },
  ];

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    source: {
      kind: 'demo',
      provider: {
        id: 'demo',
        name: 'Demo',
        vocabulary: { changeRequest: 'Pull request', changeRequestShort: 'PR', pipeline: 'Pipeline' },
      },
      capabilities: { changeRequests: 'native', reviews: 'native', pipelines: 'native', deployments: 'native', documents: 'native', workItems: 'native', workstreams: 'native' },
      generatedAt: now.toISOString(),
    },
    organization: { id: 'org-lanterna-norte', name: 'Lanterna Norte', slug: 'lanterna-norte' },
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
    workItems,
    workstreams,
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
