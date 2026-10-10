import type { ProviderVocabulary } from '@domain/entities';
import { listDeliveries } from '@application/queries/deliveries';
import type { ForgeIndex } from '@application/queries/forgeIndex';
import type { ScopeFilter } from '@application/queries/period';

/** Pure puzzle data (pt-BR). Cards are shown when the ball hits a puzzle target. */

export type PuzzleBody =
  /** Click the items in the correct order. `items` is the correct order; `shown` is the display order. */
  | { kind: 'order'; items: string[]; shown: number[] }
  /** Pick one option. `answer` is its index. */
  | { kind: 'choice'; options: string[]; answer: number };

export type Puzzle = { id: string; question: string; explanation: string } & PuzzleBody;

export const STAGE_NAMES = ['Código', 'Revisão', 'Integração', 'Staging', 'Produção'] as const;

const TRUE_FALSE = ['Verdadeiro', 'Falso'];

export const STATIC_PUZZLES: Puzzle[] = [
  {
    id: 'pipeline-order',
    kind: 'order',
    question: 'Coloque as etapas da entrega na ordem, da primeira à última.',
    items: [...STAGE_NAMES],
    shown: [3, 0, 4, 2, 1],
    explanation: 'Código → Revisão → Integração → Staging → Produção. Cada etapa só conta quando existe uma evidência concreta dela.',
  },
  {
    id: 'merged-is-production',
    kind: 'choice',
    question: '"Integrado" é o mesmo que "em produção"?',
    options: TRUE_FALSE,
    answer: 1,
    explanation: 'Falso. Integrado significa que o código entrou na branch principal. Só há produção quando um deploy em produção confirma a mudança.',
  },
  {
    id: 'unknown-timeline',
    kind: 'choice',
    question: 'O que significa "unknown" (sem dados) na linha do tempo de uma mudança?',
    options: ['A etapa não aconteceu', 'A fonte de dados não consegue saber se a etapa aconteceu', 'A etapa falhou', 'A etapa é opcional'],
    answer: 1,
    explanation: 'Sem dados não é zero nem falha: é a fonte admitindo que não sabe (por exemplo, Git puro não conhece revisões nem deploys).',
  },
  {
    id: 'runbooks',
    kind: 'choice',
    question: 'Onde ficam os runbooks, guias e ADRs no data center?',
    options: ['No portão de produção', 'No Arquivo de Conhecimento, dentro do Hub IA', 'Na lousa', 'Em cada mesa'],
    answer: 1,
    explanation: 'O Arquivo de Conhecimento reúne specs, ADRs, runbooks e guias, ligados a iniciativas e repositórios.',
  },
  {
    id: 'production-evidence',
    kind: 'choice',
    question: 'Qual evidência prova que uma mudança está em produção?',
    options: ['Ela foi aprovada na revisão', 'Ela foi integrada na branch principal', 'Um deploy em produção bem-sucedido contém a mudança', 'A pipeline ficou verde'],
    answer: 2,
    explanation: 'Aprovação, integração e pipeline verde são etapas anteriores. A prova final é um deploy em produção que lista a mudança.',
  },
  {
    id: 'figures-illustrative',
    kind: 'choice',
    question: 'Os personagens do data center indicam produtividade ou presença de pessoas?',
    options: TRUE_FALSE,
    answer: 1,
    explanation: 'Falso. Os personagens são ilustrativos. O Forge mostra participação nas entregas, nunca pontuação, ranking ou disponibilidade.',
  },
  {
    id: 'no-data-vs-zero',
    kind: 'choice',
    question: 'Um repositório mostra "sem dados" de pipeline. Isso quer dizer 0 falhas?',
    options: TRUE_FALSE,
    answer: 1,
    explanation: 'Falso. "Sem dados" significa que a fonte não sabe. Zero falhas só vale quando a fonte realmente informa os pipelines.',
  },
];

/**
 * Builds the puzzle deck. Includes one puzzle made from REAL snapshot data when possible:
 * "which change has evidence of a production deploy?" (one in production among non-production ones).
 */
export function buildPuzzles(index: ForgeIndex, scope: ScopeFilter, vocab: ProviderVocabulary): Puzzle[] {
  const wide: ScopeFilter = { ...scope, squadId: null, periodDays: 30 };
  const all = listDeliveries(index, wide);
  const prod = all.find((d) => d.status === 'in_production');
  const others = all.filter((d) => d.status === 'in_staging' || d.status === 'merged' || d.status === 'approved' || d.status === 'awaiting_review').slice(0, 3);
  const deck = [...STATIC_PUZZLES];
  if (prod && others.length >= 2) {
    const label = (d: (typeof all)[number]) => `${vocab.changeRequestShort} #${d.cr.number} · ${d.cr.title}`;
    const options = others.map(label);
    const answer = prod.cr.number % (options.length + 1);
    options.splice(answer, 0, label(prod));
    deck.splice(2, 0, {
      id: 'real-production',
      kind: 'choice',
      question: `Qual ${vocab.changeRequestShort} tem evidência de deploy em produção?`,
      options,
      answer,
      explanation: `${label(prod)} tem um deploy em produção bem-sucedido que a contém. As outras ainda não têm essa evidência (revisão, integração ou staging não bastam).`,
    });
  }
  return deck;
}

export function isOrderCorrect(p: Extract<Puzzle, { kind: 'order' }>, picked: number[]): boolean {
  return picked.length === p.items.length && picked.every((idx, i) => idx === i);
}
