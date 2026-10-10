import { describe, expect, it } from 'vitest';
import { ConfluenceConnector, kindFromLabels, mapConfluencePage, type ConfluenceConfig } from './confluence';

const config: ConfluenceConfig = {
  baseUrl: 'https://acme.example.net',
  spaceKeys: ['ENG'],
  labelToInitiative: { 'ini-12': 'ini-ini-12' },
  labelToRepo: { payments: 'repo-payments-api' },
};
const page = (id: string, labels: string[]) => ({
  id,
  title: `Página ${id}`,
  space: { key: 'ENG' },
  version: { when: '2026-01-02T03:04:05.000Z' },
  metadata: { labels: { results: labels.map((name) => ({ name })) } },
  _links: { webui: `/spaces/ENG/pages/${id}` },
});

describe('confluence', () => {
  it('derives kind from labels, default guide', () => {
    expect(kindFromLabels(['ADR'])).toBe('adr');
    expect(kindFromLabels(['post-mortem'])).toBe('postmortem');
    expect(kindFromLabels(['x'])).toBe('guide');
  });

  it('maps a page with explicit label links only', () => {
    expect(mapConfluencePage(page('1', ['runbook', 'ini-12', 'payments', 'outro']), config)).toEqual({
      id: 'doc-confluence-1',
      title: 'Página 1',
      kind: 'runbook',
      space: 'ENG',
      squadId: null,
      initiativeIds: ['ini-ini-12'],
      repositoryIds: ['repo-payments-api'],
      updatedAt: '2026-01-02T03:04:05.000Z',
      webUrl: 'https://acme.example.net/wiki/spaces/ENG/pages/1',
    });
  });

  it('paginates per space', async () => {
    const calls: string[] = [];
    const fetchJson = async (url: string) => {
      calls.push(url);
      const start = Number(new URL(url).searchParams.get('start'));
      const n = start === 0 ? 100 : 1;
      return { results: Array.from({ length: n }, (_, i) => page(String(start + i), [])) };
    };
    const frag = await new ConfluenceConnector(config, fetchJson).collect({
      now: new Date(), since: new Date(0), secret: () => 'x', log: () => {},
    });
    expect(frag.documents).toHaveLength(101);
    expect(calls).toHaveLength(2);
    expect(frag.capabilities?.documents).toBe('native');
  });
});
