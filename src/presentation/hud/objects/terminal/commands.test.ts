import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '@infrastructure/demo/demoSnapshot';
import { buildIndex } from '@application/queries/forgeIndex';
import { listDeliveries } from '@application/queries/deliveries';
import type { ScopeFilter } from '@application/queries/period';
import { complete, editDistance, runCommand, suggest, type CommandContext } from './commands';

const now = new Date('2026-10-09T12:00:00Z');
const index = buildIndex(buildDemoSnapshot(now));
const scope: ScopeFilter = { periodDays: 30, squadId: null, now };
const ctx: CommandContext = { index, scope, vocabulary: index.snapshot.source.provider.vocabulary };
const text = (input: string) => runCommand(input, ctx).lines.map((l) => l.text).join('\n');

describe('terminal commands', () => {
  it('help lists every command', () => {
    const t = text('ajuda');
    for (const c of ['status', 'squads', 'repos', 'prs', 'entregas', 'iniciativas', 'docs', 'task', 'abrir', 'quem', 'fonte', 'sobre']) expect(t).toContain(c);
    expect(text('help')).toBe(t);
  });

  it('status shows KPIs', () => {
    expect(text('status')).toMatch(/produção/);
  });

  it('prs counts match listDeliveries', () => {
    const n = listDeliveries(index, scope, { status: 'awaiting_production' }).length;
    expect(text('prs pendentes')).toContain(`(${n})`);
    const blocked = listDeliveries(index, scope, { status: 'blocked' }).length;
    expect(text('prs bloqueadas')).toContain(`(${blocked})`);
  });

  it('entregas reports production deliveries', () => {
    const n = listDeliveries(index, scope, { status: 'production' }).length;
    expect(text('entregas')).toContain(`(${n})`);
  });

  it('rejects unknown prs status without inventing data', () => {
    expect(text('prs xyz')).toMatch(/desconhecida/);
  });

  it('docs search says when empty', () => {
    expect(text('docs zzzzqq')).toMatch(/Nenhum documento/);
    const doc = index.snapshot.documents[0];
    expect(text(`docs ${doc.title.split(' ')[0]}`)).toContain(doc.id);
  });

  it('task finds change requests by key and reports none otherwise', () => {
    const key = index.snapshot.changeRequests.find((c) => c.workItems.length)!.workItems[0].key;
    expect(text(`task ${key.toLowerCase()}`)).toContain(key);
    expect(text('task NOPE-1')).toMatch(/Nenhuma mudança/);
  });

  it('abrir returns an action for repo, initiative and document', () => {
    const repo = index.snapshot.repositories[0];
    expect(runCommand(`abrir ${repo.name}`, ctx).action).toEqual({ kind: 'repo', id: repo.id });
    const ini = index.snapshot.initiatives[0];
    expect(runCommand(`abrir ${ini.key}`, ctx).action).toEqual({ kind: 'initiative', id: ini.id });
    const doc = index.snapshot.documents[0];
    expect(runCommand(`abrir ${doc.id}`, ctx).action).toEqual({ kind: 'document', id: doc.id });
    expect(runCommand('abrir inexistente-xyz', ctx).action).toBeUndefined();
  });

  it('quem shows participation without scores', () => {
    const p = index.snapshot.contributors[0];
    const t = text(`quem @${p.handle}`);
    expect(t).toContain(p.displayName);
    expect(t).toMatch(/Sem pontuação/);
    expect(text('quem fulano-inexistente')).toMatch(/Ninguém/);
  });

  it('fonte flags demo data', () => {
    expect(text('fonte')).toMatch(/DEMO DATA/);
  });

  it('clear returns the clear action', () => {
    expect(runCommand('limpar', ctx).action).toBe('clear');
    expect(runCommand('clear', ctx).action).toBe('clear');
  });

  it('easter eggs', () => {
    expect(text('sudo deploy')).toContain('Permissão negada: em produção só com evidência.');
    expect(text('cafe')).toMatch(/rack/);
    expect(text('coffee')).toMatch(/rack/);
    expect(text('42')).toMatch(/42/);
    expect(text('sobre')).toContain('@tiagovilasboas');
  });

  it('suggests for typos and handles empty input', () => {
    expect(text('statsu')).toContain('status');
    expect(text('qwertyuiop')).toMatch(/desconhecido/);
    expect(runCommand('   ', ctx).lines).toEqual([]);
  });
});

describe('helpers', () => {
  it('edit distance', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(suggest('ajdua')).toBe('ajuda');
  });
  it('tab completion', () => {
    expect(complete('inic')).toBe('iniciativas ');
    expect(complete('s')).toBe('s');
    expect(complete('ini')).toBe('ini');
    expect(complete('sta')).toBe('status ');
    expect(complete('status ab')).toBe('status ab');
  });
});
