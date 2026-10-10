import { describe, expect, it } from 'vitest';
import { parseCsv, parsePeople, parsePlanCsv, parsePlanTarget, PlanCsvConnector } from './planCsv';

const CSV = `PRIORIDADES DE ENTREGA NA SPRINT,,,,
,Checkout Pix,Painel Lojista,Frente Vazia,
TL,Ana Lima,Bruno Reis,-,
DEV,"Carla Dias - Back/ Davi Melo (Front)",Eva Souza (Reserva),,
QA,Fábio Nunes,-,,
PM,Gil Moura,Gil Moura,,
Entrega,"MVP Semana 2 - quinta (10)",Sob demanda,,
Obs,Depende da API de parceiros,Aguardando retorno do jurídico,,
FECHAMENTOS,,,,
,Relatórios,,,
DEV,Helena Cruz,,,
Entrega,Semana 1 (Finalizado),,,
Obs,Só uma nota,,,
SUSTENTAÇÃO,,,,
,Suporte N2,,,
N2,Iara Paz,,,
TEMAS ABERTOS,,,,
,Tema Solto,,,
Entrega,15/02,,,
`;

const opts = { snapshotDate: new Date('2026-01-05T00:00:00Z'), sprintStart: new Date('2026-01-05T00:00:00Z') };

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, newlines and semicolons', () => {
    expect(parseCsv('a;"b;1";"c ""x"""\n1;2;3\r\n')).toEqual([['a', 'b;1', 'c "x"'], ['1', '2', '3']]);
  });
});

describe('parsePeople', () => {
  it('splits lists and parses specialty', () => {
    expect(parsePeople('A/ B', 'dev').map((p) => p.displayName)).toEqual(['A', 'B']);
    expect(parsePeople('Nome - Back', 'dev')[0]).toMatchObject({ displayName: 'Nome', specialty: 'back' });
    expect(parsePeople('Nome (Reserva)', 'dev')[0]).toMatchObject({ displayName: 'Nome', specialty: 'reserva' });
    expect(parsePeople('-', 'dev')).toEqual([]);
  });
});

describe('parsePlanTarget', () => {
  const snap = new Date('2026-01-05T00:00:00Z');
  const start = new Date('2026-01-05T00:00:00Z'); // Monday
  it('parses day numbers, dd/mm and weeks', () => {
    expect(parsePlanTarget('MVP Semana 2 - quinta (10)', snap, start)).toBe('2026-01-10T00:00:00.000Z');
    expect(parsePlanTarget('entrega 15/02', snap, start)).toBe('2026-02-15T00:00:00.000Z');
    expect(parsePlanTarget('Semana 2 - quinta', snap, start)).toBe('2026-01-15T00:00:00.000Z');
    expect(parsePlanTarget('Semana 1', snap, start)).toBe('2026-01-09T00:00:00.000Z');
    expect(parsePlanTarget('Semana 1', snap)).toBeNull();
    expect(parsePlanTarget('Sob demanda', snap, start)).toBeNull();
  });
  it('rolls a past day number into the next month', () => {
    expect(parsePlanTarget('(2)', snap, start)).toBe('2026-02-02T00:00:00.000Z');
  });
});

describe('parsePlanCsv', () => {
  const result = parsePlanCsv(CSV, { ...opts, people: { 'ana lima': 'ct-ana' } });
  const by = (id: string) => result.find((w) => w.id === id)!;

  it('finds fronts, skipping empty columns, with categories', () => {
    expect(result.map((w) => w.id)).toEqual(['checkout-pix', 'painel-lojista', 'frente-vazia', 'relatorios', 'suporte-n2', 'tema-solto']);
    expect(by('checkout-pix').category).toBe('sprint_priority');
    expect(by('relatorios').category).toBe('closing');
    expect(by('suporte-n2').category).toBe('sustaining');
    expect(by('tema-solto').category).toBe('open_topic');
  });

  it('parses team, plan, dependencies', () => {
    const w = by('checkout-pix');
    expect(w.team.map((t) => [t.role, t.displayName, t.specialty, t.personId])).toEqual([
      ['tl', 'Ana Lima', null, 'ct-ana'],
      ['dev', 'Carla Dias', 'back', null],
      ['dev', 'Davi Melo', 'front', null],
      ['qa', 'Fábio Nunes', null, null],
      ['pm', 'Gil Moura', null, null],
    ]);
    expect(w.plans).toEqual([{ label: 'MVP Semana 2 - quinta (10)', target: '2026-01-10T00:00:00.000Z', recordedAt: '2026-01-05T00:00:00.000Z' }]);
    expect(w.dependencies).toEqual([{ description: 'Depende da API de parceiros', kind: 'blocker' }]);
    expect(by('painel-lojista').dependencies[0].kind).toBe('waiting');
    expect(by('painel-lojista').plans[0].target).toBeNull();
    expect(by('painel-lojista').team[1]).toMatchObject({ role: 'dev', specialty: 'reserva' });
  });

  it('declaredDone, notes, empty fronts', () => {
    expect(by('relatorios').declaredDone).toBe(true);
    expect(by('relatorios').notes).toEqual(['Só uma nota']);
    expect(by('checkout-pix').declaredDone).toBe(false);
    expect(by('frente-vazia')).toMatchObject({ team: [], plans: [], dependencies: [] });
    expect(by('suporte-n2').team[0].role).toBe('n2');
  });

  it('applies front mapping', () => {
    const [w] = parsePlanCsv(CSV, { ...opts, fronts: { 'Checkout Pix': { epicKeys: ['PAY-1'], initiativeId: 'ini-1', squadIds: ['sq'] } } });
    expect(w).toMatchObject({ epicKeys: ['PAY-1'], initiativeId: 'ini-1', squadIds: ['sq'] });
  });

  it('appends a plan only when label or target changed (replan)', () => {
    const first = parsePlanCsv(CSV, opts);
    const same = parsePlanCsv(CSV, { ...opts, snapshotDate: new Date('2026-01-06T00:00:00Z'), previous: first });
    expect(same.find((w) => w.id === 'checkout-pix')!.plans).toHaveLength(1);
    const replanned = parsePlanCsv(CSV.replace('quinta (10)', 'sexta (11)'), {
      ...opts, snapshotDate: new Date('2026-01-07T00:00:00Z'), previous: first,
    });
    const plans = replanned.find((w) => w.id === 'checkout-pix')!.plans;
    expect(plans.map((p) => p.label)).toEqual(['MVP Semana 2 - quinta (10)', 'MVP Semana 2 - sexta (11)']);
    expect(plans[1].recordedAt).toBe('2026-01-07T00:00:00.000Z');
  });
});

describe('PlanCsvConnector', () => {
  it('chains previous exports and resolves people by email', async () => {
    const files: Record<string, { text: string; modifiedAt: Date }> = {
      'old.csv': { text: CSV.replace('quinta (10)', 'sexta (11)'), modifiedAt: new Date('2026-01-02T00:00:00Z') },
      'now.csv': { text: CSV, modifiedAt: new Date('2026-01-05T00:00:00Z') },
    };
    const c = new PlanCsvConnector(
      { path: 'now.csv', previous: ['old.csv'], sprintStart: '2026-01-05', people: [{ email: 'Ana@Example.com', displayName: 'Ana Lima' }] },
      async (p) => files[p],
    );
    const frag = await c.collect({ now: new Date(), since: new Date(0), secret: () => undefined, log: () => {} });
    const w = frag.workstreams!.find((x) => x.id === 'checkout-pix')!;
    expect(w.plans).toHaveLength(2);
    expect(w.team[0].personId).toBe('ct-ana-example-com');
    expect(frag.capabilities?.workstreams).toBe('native');
  });
});
