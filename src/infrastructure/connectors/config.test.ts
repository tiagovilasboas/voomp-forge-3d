import { describe, expect, it } from 'vitest';
import { connectorBlocks } from './config';

describe('connectorBlocks', () => {
  it('treats the legacy shape as one git-local connector', () => {
    const blocks = connectorBlocks({ organization: { name: 'A' }, squads: [] });
    expect(blocks).toEqual([{ organization: { name: 'A' }, squads: [], type: 'git-local' }]);
  });

  it('shares top-level keys with git-local and people with plan-csv', () => {
    const blocks = connectorBlocks({
      organization: { name: 'A' },
      people: [{ email: 'a@x.io' }],
      connectors: [{ type: 'git-local', squads: [] }, { type: 'plan-csv', path: 'f.csv' }, { type: 'jira', baseUrl: 'u' }],
    });
    expect(blocks[0]).toMatchObject({ organization: { name: 'A' }, squads: [] });
    expect(blocks[1]).toMatchObject({ people: [{ email: 'a@x.io' }], path: 'f.csv' });
    expect(blocks[2]).toEqual({ type: 'jira', baseUrl: 'u' });
  });
});
