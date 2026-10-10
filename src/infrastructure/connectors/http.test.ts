import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSafeBaseUrl, defaultFetchJson } from './http';
import { JiraConnector } from './jira';
import { ConfluenceConnector } from './confluence';

describe('assertSafeBaseUrl', () => {
  it.each(['https://acme.atlassian.net', 'http://localhost:8080', 'http://127.0.0.1:9000/x'])('accepts %s', (u) => {
    expect(() => assertSafeBaseUrl('jira', u)).not.toThrow();
  });

  it.each(['http://acme.atlassian.net', 'ftp://acme.net', 'http://localhost.evil.com', 'http://127.0.0.1.evil.com'])('rejects %s', (u) => {
    expect(() => assertSafeBaseUrl('jira', u)).toThrow(/https/);
  });

  it('rejects invalid URLs', () => {
    expect(() => assertSafeBaseUrl('jira', 'não é url')).toThrow(/URL válida/);
  });

  it('rejects userinfo and never echoes the URL or its secret', () => {
    for (const u of ['https://bob:s3cr3t@acme.net', 'https://tok3n@acme.net', 'http://bob:s3cr3t@localhost']) {
      let msg = '';
      try { assertSafeBaseUrl('confluence', u); } catch (e) { msg = (e as Error).message; }
      expect(msg).toMatch(/usuário\/senha/);
      expect(msg).not.toMatch(/s3cr3t|tok3n|bob|acme/);
    }
  });

  it('is enforced by both connectors', () => {
    expect(() => new JiraConnector({ baseUrl: 'http://acme.net', project: 'P', productionStatuses: [] })).toThrow(/https/);
    expect(() => new ConfluenceConnector({ baseUrl: 'http://acme.net', spaceKeys: ['A'] })).toThrow(/https/);
    expect(() => new ConfluenceConnector({ baseUrl: 'https://u:p@acme.net', spaceKeys: ['A'] })).toThrow(/usuário\/senha/);
  });
});

describe('defaultFetchJson', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses redirects so Authorization never reaches another origin', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await defaultFetchJson('https://acme.net/x', { Authorization: 'Basic abc' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });

  it('http errors omit credentials and query string', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    const err = await defaultFetchJson('https://acme.net/rest?jql=secret', { Authorization: 'Basic abc' }).catch((e: Error) => e);
    expect((err as Error).message).toBe('Falha ao consultar https://acme.net/rest: HTTP 401');
  });
});

describe('pagination bounds', () => {
  const ctx = { secret: () => 'x', log: () => {} } as never;

  it('jira stops a server that never ends', async () => {
    const c = new JiraConnector({ baseUrl: 'https://a.net', project: 'P', productionStatuses: [] }, async () => ({ total: 1e9, issues: [{ key: 'P-1' }] }));
    await expect(c.collect(ctx)).rejects.toThrow(/limite/);
  });

  it('confluence stops a server that never ends', async () => {
    const full = { results: Array.from({ length: 100 }, (_, i) => ({ id: String(i), title: 't' })) };
    const c = new ConfluenceConnector({ baseUrl: 'https://a.net', spaceKeys: ['A'] }, async () => full);
    await expect(c.collect(ctx)).rejects.toThrow(/limite/);
  });

  it('ignores non-array payloads from untrusted JSON', async () => {
    const j = new JiraConnector({ baseUrl: 'https://a.net', project: 'P', productionStatuses: [] }, async () => ({ issues: 'x', total: 5 }));
    expect((await j.collect(ctx)).workItems).toEqual([]);
    const c = new ConfluenceConnector({ baseUrl: 'https://a.net', spaceKeys: ['A'] }, async () => ({ results: {} }));
    expect((await c.collect(ctx)).documents).toEqual([]);
  });
});
