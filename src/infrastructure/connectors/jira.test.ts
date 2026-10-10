import { describe, expect, it } from 'vitest';
import type { ConnectorContext } from '@application/ports/connectors';
import { JiraConnector, mapJiraIssue, type JiraConfig } from './jira';

const config: JiraConfig = {
  baseUrl: 'https://acme.example.net/',
  project: 'PAY',
  epicLinkField: 'customfield_10014',
  sprintField: 'customfield_10020',
  productionStatuses: ['Em Produção', 'Deployed'],
  productionByFixVersionReleased: true,
};

const base = {
  key: 'PAY-7',
  fields: {
    summary: 'Pix parcelado',
    issuetype: { name: 'Story' },
    status: { name: 'Em Produção', statusCategory: { key: 'done' } },
    parent: { key: 'PAY-1', fields: { issuetype: { name: 'Epic' } } },
    customfield_10020: [{ name: 'Sprint 3', state: 'closed' }, { name: 'Sprint 4', state: 'active' }],
    updated: '2026-01-05T10:00:00.000-0300',
    statuscategorychangedate: '2026-01-04T12:00:00.000+0000',
    resolutiondate: '2026-01-03T12:00:00.000+0000',
  },
};

describe('mapJiraIssue', () => {
  it('maps a production issue', () => {
    expect(mapJiraIssue(base, config)).toEqual({
      key: 'PAY-7',
      title: 'Pix parcelado',
      type: 'story',
      status: 'done',
      statusName: 'Em Produção',
      epicKey: 'PAY-1',
      sprint: 'Sprint 4',
      updatedAt: '2026-01-05T13:00:00.000Z',
      productionAt: '2026-01-04T12:00:00.000Z',
      url: 'https://acme.example.net/browse/PAY-7',
    });
  });

  it('does not claim production for other statuses', () => {
    const item = mapJiraIssue(
      { key: 'PAY-8', fields: { ...base.fields, status: { name: 'Em QA', statusCategory: { key: 'indeterminate' } } } },
      config,
    );
    expect(item.status).toBe('in_progress');
    expect(item.productionAt).toBeNull();
  });

  it('uses released fix versions only when the flag is on', () => {
    const raw = {
      key: 'PAY-9',
      fields: {
        ...base.fields,
        status: { name: 'Done', statusCategory: { key: 'done' } },
        fixVersions: [{ released: true, releaseDate: '2026-01-08' }, { released: false, releaseDate: '2026-02-01' }],
      },
    };
    expect(mapJiraIssue(raw, config).productionAt).toBe('2026-01-08T00:00:00.000Z');
    expect(mapJiraIssue(raw, { ...config, productionByFixVersionReleased: false }).productionAt).toBeNull();
  });

  it('reads epic link field, legacy sprint strings, ignores non-epic parents', () => {
    const item = mapJiraIssue(
      {
        key: 'PAY-10',
        fields: {
          summary: 'x', issuetype: { name: 'Bug' }, status: { name: 'To Do', statusCategory: { key: 'new' } },
          customfield_10014: 'PAY-2',
          customfield_10020: ['com.atlassian...Sprint@1[id=1,state=ACTIVE,name=Sprint 9,goal=]'],
          updated: '2026-01-01T00:00:00Z',
        },
      },
      config,
    );
    expect(item).toMatchObject({ type: 'bug', status: 'todo', epicKey: 'PAY-2', sprint: 'Sprint 9' });
    const sub = mapJiraIssue(
      { key: 'PAY-11', fields: { ...base.fields, issuetype: { name: 'Sub-task' }, parent: { key: 'PAY-7', fields: { issuetype: { name: 'Story' } } } } },
      { ...config, epicLinkField: undefined },
    );
    expect(sub.type).toBe('task');
    expect(sub.epicKey).toBeNull();
  });
});

describe('JiraConnector', () => {
  const secrets: Record<string, string> = { JIRA_EMAIL: 'a@example.com', JIRA_API_TOKEN: 'tok' };
  const ctx = (log: string[] = []): ConnectorContext => ({
    now: new Date(), since: new Date(0), secret: (n) => secrets[n], log: (m) => log.push(m),
  });

  it('paginates and sends basic auth without leaking it into logs', async () => {
    const urls: string[] = [];
    let auth = '';
    const issue = (n: number) => ({ key: `PAY-${n}`, fields: { ...base.fields } });
    const fetchJson = async (url: string, headers: Record<string, string>) => {
      urls.push(url);
      auth = headers.Authorization;
      const start = Number(new URL(url).searchParams.get('startAt'));
      return { total: 3, issues: start === 0 ? [issue(1), issue(2)] : [issue(3)] };
    };
    const logs: string[] = [];
    const fragment = await new JiraConnector(config, fetchJson).collect(ctx(logs));
    expect(fragment.workItems).toHaveLength(3);
    expect(fragment.capabilities?.workItems).toBe('native');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('/rest/api/3/search?jql=');
    expect(auth).toBe(`Basic ${Buffer.from('a@example.com:tok').toString('base64')}`);
    expect(logs.join(' ')).not.toContain('tok');
  });

  it('fails clearly without secrets and validates config', async () => {
    const c = new JiraConnector(config, async () => ({}));
    await expect(c.collect({ ...ctx(), secret: () => undefined })).rejects.toThrow(/JIRA_EMAIL/);
    expect(() => new JiraConnector({ ...config, project: undefined })).toThrow(/project/);
  });
});
