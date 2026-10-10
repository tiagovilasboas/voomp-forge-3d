import { describe, expect, it } from 'vitest';
import { buildConnectors, createRegistry } from './registry';
import type { RunGit } from './gitLocal';

const US = '\x1f';
const RS = '\x1e';

describe('registry + git-local', () => {
  it('rejects unknown connector types', () => {
    const reg = createRegistry({ runGit: async () => '', readText: async () => ({ text: '', modifiedAt: new Date() }) });
    expect(() => buildConnectors([{ type: 'nope' }], reg)).toThrow(/nope/);
    expect(buildConnectors([{ type: 'confluence', baseUrl: 'https://x', spaceKeys: ['A'] } as never], reg)[0].type).toBe('confluence');
  });

  it('collects a fragment through the injected runGit', async () => {
    const calls: string[][] = [];
    const runGit: RunGit = async (_path, args) => {
      calls.push(args);
      if (args[0] === 'log') {
        return `${RS}${['aaa', '', 'Ana', 'ana@example.com', '2026-01-01T10:00:00+00:00', 'feat: início PAY-1', ''].join(US)}`;
      }
      return `v1.0.0${US}aaa${US}${US}2026-01-02T10:00:00+00:00\n`;
    };
    const reg = createRegistry({ runGit, readText: async () => ({ text: '', modifiedAt: new Date() }) });
    const [connector] = buildConnectors(
      [
        {
          type: 'git-local',
          organization: { name: 'Acme' },
          squads: [{ id: 's1', code: 'A', name: 'Pag', repositories: [{ path: 'repo' }] }],
          deployments: [{ environment: 'production', tagPattern: '^v' }],
        } as never,
      ],
      reg,
    );
    const frag = await connector.collect({ now: new Date('2026-01-10T00:00:00Z'), since: new Date(0), secret: () => undefined, log: () => {} });
    expect(frag.repositories).toHaveLength(1);
    expect(frag.commits).toHaveLength(1);
    expect(frag.deployments).toHaveLength(1);
    expect(frag.organization?.name).toBe('Acme');
    expect(calls[0].some((a) => a.startsWith('--since'))).toBe(false);

    await connector.collect({ now: new Date(), since: new Date('2026-01-01T00:00:00Z'), secret: () => undefined, log: () => {} });
    expect(calls.some((a) => a.some((x) => x.startsWith('--since=2026-01-01')))).toBe(true);
  });
});
