import type { ProviderVocabulary } from '@domain/entities';
import type { ForgeIndex } from '@application/queries/forgeIndex';
import { listDeliveries, toDelivery, type Delivery, type StatusFilter } from '@application/queries/deliveries';
import { initiativeSummaries } from '@application/queries/initiatives';
import { computeKpis } from '@application/queries/kpis';
import type { ScopeFilter } from '@application/queries/period';
import { personSummary } from '@application/queries/summaries';
import { STATUS_LOOK } from '../../../theme';
import type { EntityRef } from '../../../world/worldModel';

/**
 * Deterministic terminal commands. Pure: (input, context) -> output. No AI, no network,
 * nothing invented — every line comes from the loaded snapshot.
 */

export type Tone = 'out' | 'dim' | 'ok' | 'warn' | 'err' | 'accent';
export interface TermLine {
  text: string;
  tone: Tone;
}
export interface CommandResult {
  lines: TermLine[];
  action?: EntityRef | 'clear';
}
export interface CommandContext {
  index: ForgeIndex;
  scope: ScopeFilter;
  vocabulary: ProviderVocabulary;
}

const MAX_ROWS = 14;
const line = (text: string, tone: Tone = 'out'): TermLine => ({ text, tone });

interface CommandDef {
  name: string;
  aliases: string[];
  usage: string;
  help: string;
}

const COMMANDS: CommandDef[] = [
  { name: 'ajuda', aliases: ['help', '?'], usage: 'ajuda', help: 'lista os comandos' },
  { name: 'status', aliases: [], usage: 'status', help: 'indicadores do período e da squad em foco' },
  { name: 'squads', aliases: [], usage: 'squads', help: 'squads, repositórios e pessoas' },
  { name: 'repos', aliases: [], usage: 'repos [squad]', help: 'repositórios (filtre por squad)' },
  { name: 'prs', aliases: [], usage: 'prs [aguardando|bloqueadas|producao|staging|integradas]', help: 'mudanças por situação' },
  { name: 'entregas', aliases: ['deliveries'], usage: 'entregas', help: 'o que chegou à produção no período' },
  { name: 'iniciativas', aliases: ['initiatives'], usage: 'iniciativas', help: 'iniciativas e andamento' },
  { name: 'docs', aliases: [], usage: 'docs <termo>', help: 'busca no Arquivo de Conhecimento' },
  { name: 'task', aliases: [], usage: 'task <CHAVE>', help: 'mudanças que citam uma tarefa' },
  { name: 'abrir', aliases: ['open'], usage: 'abrir <repo|#n|INI-xxx|doc-id>', help: 'abre e centraliza a entidade' },
  { name: 'quem', aliases: ['who'], usage: 'quem <handle>', help: 'participação de uma pessoa (sem ranking)' },
  { name: 'fonte', aliases: ['source'], usage: 'fonte', help: 'origem e limites dos dados' },
  { name: 'limpar', aliases: ['clear', 'cls'], usage: 'limpar', help: 'limpa a tela (Ctrl+L)' },
  { name: 'sobre', aliases: ['about'], usage: 'sobre', help: 'sobre o Voomp Forge' },
];

/** Names offered by Tab completion. */
export const COMMAND_NAMES: string[] = COMMANDS.flatMap((c) => [c.name, ...c.aliases.filter((a) => /^[a-z]/.test(a))]);

export const BANNER: TermLine[] = [
  line('HUB IA · terminal (sem IA — consultas determinísticas ao snapshot)', 'accent'),
  line('Digite "ajuda" para ver os comandos. Tab completa, ↑/↓ histórico, Ctrl+L limpa.', 'dim'),
];

/** Complete a command name from a typed prefix (single token only). Returns the unique/common completion. */
export function complete(input: string): string {
  if (/\s/.test(input) || input === '') return input;
  const p = input.toLowerCase();
  const matches = COMMAND_NAMES.filter((n) => n.startsWith(p));
  if (matches.length === 0) return input;
  if (matches.length === 1) return matches[0] + ' ';
  let common = matches[0];
  for (const m of matches) while (!m.startsWith(common)) common = common.slice(0, -1);
  return common.length > p.length ? common : input;
}

export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function suggest(word: string): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const n of COMMAND_NAMES) {
    const d = editDistance(word, n);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best !== null && bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const STATUS_ARGS: Record<string, { filter: StatusFilter; label: string }> = {
  aguardando: { filter: 'review', label: 'aguardando revisão' },
  revisao: { filter: 'review', label: 'aguardando revisão' },
  review: { filter: 'review', label: 'aguardando revisão' },
  bloqueadas: { filter: 'blocked', label: 'bloqueadas' },
  bloqueados: { filter: 'blocked', label: 'bloqueadas' },
  blocked: { filter: 'blocked', label: 'bloqueadas' },
  producao: { filter: 'production', label: 'em produção' },
  production: { filter: 'production', label: 'em produção' },
  staging: { filter: 'staging', label: 'em staging' },
  integradas: { filter: 'integrated', label: 'integradas, sem deploy' },
  integrados: { filter: 'integrated', label: 'integradas, sem deploy' },
  integrated: { filter: 'integrated', label: 'integradas, sem deploy' },
  pendentes: { filter: 'awaiting_production', label: 'integradas mas ainda não em produção' },
};

function scopeLabel(ctx: CommandContext): string {
  const sq = ctx.scope.squadId ? ctx.index.squad.get(ctx.scope.squadId) : null;
  return `${ctx.scope.periodDays} dias · ${sq ? `squad ${sq.name}` : 'todas as squads'}`;
}

function deliveryRows(list: Delivery[], ctx: CommandContext): TermLine[] {
  const short = ctx.vocabulary.changeRequestShort;
  const rows = list.slice(0, MAX_ROWS).map((d) =>
    line(`${short} #${d.cr.number}  ${d.cr.title}  · ${d.repo.name} · ${STATUS_LOOK[d.status].label}`),
  );
  if (list.length > MAX_ROWS) rows.push(line(`… e mais ${list.length - MAX_ROWS}. Use o Delivery Explorer para ver todas.`, 'dim'));
  return rows;
}

function cmdHelp(): CommandResult {
  const width = Math.max(...COMMANDS.map((c) => c.usage.length));
  return {
    lines: [
      line('Comandos:', 'accent'),
      ...COMMANDS.map((c) => line(`  ${c.usage.padEnd(width + 2)}${c.help}`)),
      line('Aliases em inglês: help, deliveries, initiatives, open, who, source, clear, about.', 'dim'),
    ],
  };
}

function cmdStatus(ctx: CommandContext): CommandResult {
  const k = computeKpis(ctx.index, ctx.scope);
  const short = ctx.vocabulary.changeRequestShort;
  return {
    lines: [
      line(`Indicadores · ${scopeLabel(ctx)}`, 'accent'),
      line(`  ${short}s integrados ........ ${k.merged}`),
      line(`  Aguardando revisão ...... ${k.awaitingReview}`, k.awaitingReview > 0 ? 'warn' : 'out'),
      line(`  Falhas de pipeline ...... ${k.pipelineFailures}`, k.pipelineFailures > 0 ? 'err' : 'out'),
      line(`  Deploys em produção ..... ${k.productionDeploys}`, 'ok'),
      line(`  Entregas c/ iniciativa .. ${k.initiativeDeliveries}`),
      line('Integrado ≠ em produção: só conta como entregue com deploy confirmado.', 'dim'),
    ],
  };
}

function cmdSquads(ctx: CommandContext): CommandResult {
  const { squads } = ctx.index.snapshot;
  if (squads.length === 0) return { lines: [line('Nenhuma squad nos dados.', 'warn')] };
  return {
    lines: squads.map((s) => {
      const repos = ctx.index.reposBySquad.get(s.id)?.length ?? 0;
      const people = ctx.index.peopleBySquad.get(s.id)?.length ?? 0;
      return line(`  ${s.code}  ${s.name} · ${repos} repositórios · ${people} pessoas`);
    }),
  };
}

function cmdRepos(args: string[], ctx: CommandContext): CommandResult {
  const { repositories, squads } = ctx.index.snapshot;
  const q = norm(args.join(' '));
  let list = repositories;
  let title = 'Repositórios';
  if (q) {
    const squad = squads.find((s) => norm(s.code) === q || norm(s.name).includes(q) || norm(s.id) === q);
    if (!squad) return { lines: [line(`Squad "${args.join(' ')}" não encontrada. Digite "squads".`, 'warn')] };
    list = repositories.filter((r) => r.squadId === squad.id);
    title = `Repositórios da squad ${squad.name}`;
  }
  if (list.length === 0) return { lines: [line('Nenhum repositório encontrado.', 'warn')] };
  return {
    lines: [
      line(`${title} (${list.length})`, 'accent'),
      ...list.slice(0, 30).map((r) => line(`  ${r.name}  · ${r.language} · ${ctx.index.squad.get(r.squadId)?.name ?? '—'}`)),
    ],
  };
}

function cmdPrs(args: string[], ctx: CommandContext): CommandResult {
  const word = norm(args[0] ?? '');
  const short = ctx.vocabulary.changeRequestShort;
  if (word && !STATUS_ARGS[word]) {
    return { lines: [line(`Situação "${args[0]}" desconhecida. Use: aguardando, bloqueadas, producao, staging, integradas.`, 'warn')] };
  }
  const sel = word ? STATUS_ARGS[word] : null;
  const list = listDeliveries(ctx.index, ctx.scope, sel ? { status: sel.filter } : {});
  const head = line(`${short}s ${sel ? sel.label : 'no período'} · ${scopeLabel(ctx)} (${list.length})`, 'accent');
  if (list.length === 0) return { lines: [head, line('Nenhuma mudança nesta situação no período.', 'dim')] };
  return { lines: [head, ...deliveryRows(list, ctx)] };
}

function cmdEntregas(ctx: CommandContext): CommandResult {
  const list = listDeliveries(ctx.index, ctx.scope, { status: 'production' });
  const head = line(`Chegaram à produção · ${scopeLabel(ctx)} (${list.length})`, 'ok');
  if (list.length === 0) return { lines: [head, line('Nada com deploy em produção confirmado no período.', 'dim')] };
  return { lines: [head, ...deliveryRows(list, ctx)] };
}

function cmdIniciativas(ctx: CommandContext): CommandResult {
  const sums = initiativeSummaries(ctx.index, ctx.scope);
  if (sums.length === 0) return { lines: [line('Nenhuma iniciativa nos dados.', 'warn')] };
  return {
    lines: [
      line(`Iniciativas · ${ctx.scope.periodDays} dias`, 'accent'),
      ...sums.flatMap((s) => [
        line(`  ${s.initiative.key}  ${s.initiative.name}  · ${s.inProduction.length}/${s.deliveries.length} em produção`),
        line(`      ${s.headline}`, 'dim'),
      ]),
    ],
  };
}

function cmdDocs(args: string[], ctx: CommandContext): CommandResult {
  const q = norm(args.join(' '));
  if (!q) return { lines: [line('Uso: docs <termo>', 'warn')] };
  const found = ctx.index.snapshot.documents.filter((d) => norm(d.title).includes(q));
  if (found.length === 0) return { lines: [line(`Nenhum documento com "${args.join(' ')}" no título.`, 'dim')] };
  return {
    lines: [
      line(`Documentos (${found.length})`, 'accent'),
      ...found.slice(0, MAX_ROWS).map((d) => line(`  ${d.id}  ${d.title}  · ${d.kind} · ${d.space}`)),
      line('Use "abrir <doc-id>" para abrir.', 'dim'),
    ],
  };
}

function cmdTask(args: string[], ctx: CommandContext): CommandResult {
  const key = (args[0] ?? '').toUpperCase();
  if (!key) return { lines: [line('Uso: task <CHAVE>  (ex.: task ABC-123)', 'warn')] };
  const crs = ctx.index.snapshot.changeRequests.filter((cr) => cr.workItems.some((w) => w.key.toUpperCase() === key));
  if (crs.length === 0) return { lines: [line(`Nenhuma mudança cita a tarefa ${key}.`, 'dim')] };
  const short = ctx.vocabulary.changeRequestShort;
  return {
    lines: [
      line(`Mudanças que citam ${key} (${crs.length})`, 'accent'),
      ...crs.slice(0, MAX_ROWS).map((cr) => {
        const repo = ctx.index.repo.get(cr.repositoryId);
        const d = toDelivery(ctx.index, cr);
        return line(`  ${short} #${cr.number}  ${cr.title}  · ${repo?.name ?? '—'} · ${STATUS_LOOK[d.status].label}`);
      }),
    ],
  };
}

function cmdAbrir(args: string[], ctx: CommandContext): CommandResult {
  const raw = args.join(' ').trim();
  if (!raw) return { lines: [line('Uso: abrir <repo|#n|INI-xxx|doc-id>', 'warn')] };
  const q = norm(raw);
  const { snapshot } = ctx.index;
  const num = /^#?(\d+)$/.exec(raw);
  if (num && raw.startsWith('#')) {
    const crs = snapshot.changeRequests.filter((c) => c.number === Number(num[1]));
    if (crs.length === 0) return { lines: [line(`Nenhuma mudança #${num[1]}.`, 'warn')] };
    if (crs.length > 1) {
      return {
        lines: [
          line(`#${num[1]} existe em ${crs.length} repositórios. Seja específico:`, 'warn'),
          ...crs.map((c) => line(`  abrir ${c.id}  (${ctx.index.repo.get(c.repositoryId)?.name ?? '—'})`)),
        ],
      };
    }
    return { lines: [line(`Abrindo #${crs[0].number}…`, 'ok')], action: { kind: 'cr', id: crs[0].id } };
  }
  const cr = ctx.index.cr.get(raw);
  if (cr) return { lines: [line(`Abrindo ${cr.title}…`, 'ok')], action: { kind: 'cr', id: cr.id } };
  const ini = snapshot.initiatives.find((i) => norm(i.key) === q || norm(i.id) === q);
  if (ini) return { lines: [line(`Abrindo ${ini.key} · ${ini.name}…`, 'ok')], action: { kind: 'initiative', id: ini.id } };
  const doc = ctx.index.document.get(raw);
  if (doc) return { lines: [line(`Abrindo documento ${doc.title}…`, 'ok')], action: { kind: 'document', id: doc.id } };
  const repos = snapshot.repositories.filter((r) => norm(r.name) === q || norm(r.fullName) === q || norm(r.id) === q);
  const fuzzy = repos.length ? repos : snapshot.repositories.filter((r) => norm(r.name).includes(q));
  if (fuzzy.length === 1) return { lines: [line(`Abrindo ${fuzzy[0].name}…`, 'ok')], action: { kind: 'repo', id: fuzzy[0].id } };
  if (fuzzy.length > 1) {
    return { lines: [line(`"${raw}" é ambíguo:`, 'warn'), ...fuzzy.slice(0, 8).map((r) => line(`  abrir ${r.name}`))] };
  }
  return { lines: [line(`Nada encontrado para "${raw}". Tente um repositório, #número, chave de iniciativa ou id de documento.`, 'warn')] };
}

function cmdQuem(args: string[], ctx: CommandContext): CommandResult {
  const h = norm((args[0] ?? '').replace(/^@/, ''));
  if (!h) return { lines: [line('Uso: quem <handle>', 'warn')] };
  const person = ctx.index.snapshot.contributors.find((c) => norm(c.handle.replace(/^@/, '')) === h);
  if (!person) return { lines: [line(`Ninguém com o handle "${args[0]}" nos dados.`, 'warn')] };
  const s = personSummary(ctx.index, person.id, ctx.scope);
  const short = ctx.vocabulary.changeRequestShort;
  const out: TermLine[] = [
    line(`${person.displayName} (@${person.handle.replace(/^@/, '')}) · ${s.squad?.name ?? 'sem squad'}`, 'accent'),
    line(`Participação em ${ctx.scope.periodDays} dias: ${s.authored.length} ${short}s autorados · ${s.reviews.length} revisões`),
  ];
  if (s.authored.length) {
    out.push(line('Autorou:', 'dim'), ...s.authored.slice(0, 6).map((d) => line(`  #${d.cr.number} ${d.cr.title} · ${d.repo.name}`)));
  }
  if (s.reviewedDeliveries.length) {
    out.push(line('Revisou:', 'dim'), ...s.reviewedDeliveries.slice(0, 6).map((d) => line(`  #${d.cr.number} ${d.cr.title} · ${d.repo.name}`)));
  }
  out.push(line('Sem pontuação ou ranking: isto mostra participação, não desempenho.', 'dim'));
  return { lines: out };
}

function cmdFonte(ctx: CommandContext): CommandResult {
  const { source } = ctx.index.snapshot;
  const caps = source.capabilities;
  const demo = source.kind === 'demo';
  return {
    lines: [
      demo ? line('DEMO DATA — dados fictícios, nada aqui é de uma empresa real.', 'warn') : line(`Fonte: ${source.kind}`, 'ok'),
      line(`  tipo ............ ${source.kind}`),
      line(`  provedor ........ ${source.provider.name} (${source.provider.id})`),
      line(`  gerado em ....... ${source.generatedAt}`),
      line('  capacidades:', 'dim'),
      ...(['changeRequests', 'reviews', 'pipelines', 'deployments', 'documents'] as const).map((k) =>
        line(`    ${k.padEnd(15)} ${caps[k]}`, caps[k] === 'unavailable' ? 'warn' : 'out'),
      ),
      line('"unavailable" = a fonte não sabe; a tela mostra "sem dados", nunca zero.', 'dim'),
    ],
  };
}

function cmdSobre(): CommandResult {
  return {
    lines: [
      line('Voomp Forge — From Code to Delivery', 'accent'),
      line('Um data center 3D que mostra o caminho do código até a produção, com evidências.'),
      line('Feito com Claude Code · autor: @tiagovilasboas'),
    ],
  };
}

function cmdCafe(): CommandResult {
  return {
    lines: [
      line('    ( (', 'warn'),
      line('     ) )', 'warn'),
      line('   ........', 'accent'),
      line('   |      |]', 'accent'),
      line('   \\      /', 'accent'),
      line("    `----'", 'accent'),
      line('Dica: no data center, cada rack é um repositório; o brilho mostra sinais de saúde e o portão', 'dim'),
      line('só se abre para o que tem deploy em produção confirmado.', 'dim'),
    ],
  };
}

/** Run one input line. Never throws. */
export function runCommand(input: string, ctx: CommandContext): CommandResult {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { lines: [] };
  const cmd = norm(tokens[0]);
  const args = tokens.slice(1);

  if (cmd === 'sudo') return { lines: [line('Permissão negada: em produção só com evidência. 😉', 'err')] };
  if (cmd === '42') return { lines: [line('A resposta para a vida, o universo e tudo mais. Mas "42" não é um status de entrega.', 'accent')] };

  const def = COMMANDS.find((c) => c.name === cmd || c.aliases.includes(cmd));
  const name = def?.name ?? (cmd === 'cafe' || cmd === 'coffee' ? 'cafe' : '');
  switch (name) {
    case 'ajuda':
      return cmdHelp();
    case 'status':
      return cmdStatus(ctx);
    case 'squads':
      return cmdSquads(ctx);
    case 'repos':
      return cmdRepos(args, ctx);
    case 'prs':
      return cmdPrs(args, ctx);
    case 'entregas':
      return cmdEntregas(ctx);
    case 'iniciativas':
      return cmdIniciativas(ctx);
    case 'docs':
      return cmdDocs(args, ctx);
    case 'task':
      return cmdTask(args, ctx);
    case 'abrir':
      return cmdAbrir(args, ctx);
    case 'quem':
      return cmdQuem(args, ctx);
    case 'fonte':
      return cmdFonte(ctx);
    case 'limpar':
      return { lines: [], action: 'clear' };
    case 'sobre':
      return cmdSobre();
    case 'cafe':
      return cmdCafe();
  }
  const hint = suggest(cmd);
  return {
    lines: [line(`Comando desconhecido: ${tokens[0]}.${hint ? ` Você quis dizer "${hint}"?` : ''} Digite "ajuda".`, 'err')],
  };
}
