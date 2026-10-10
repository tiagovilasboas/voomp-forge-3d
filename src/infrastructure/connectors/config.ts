/**
 * forge.config.json → connector blocks.
 * New shape: `{ organization, provider?, people?, connectors: [{ type, ... }] }`.
 * Legacy shape (no `connectors`): the whole file is one `git-local` connector.
 * Shared top-level keys (organization, provider, people, initiatives…) are inherited by `git-local`
 * blocks that do not set them; `plan-csv` inherits `people`.
 */
export type ConnectorBlock = { type: string } & Record<string, unknown>;

export function connectorBlocks(config: Record<string, unknown>): ConnectorBlock[] {
  const list = config.connectors;
  if (!Array.isArray(list)) return [{ ...config, type: 'git-local' }];
  const { connectors: _ignored, ...shared } = config;
  return list.map((raw) => {
    const block = raw as ConnectorBlock;
    if (!block || typeof block.type !== 'string') throw new Error('Cada item de "connectors" precisa de "type".');
    if (block.type === 'git-local') return { ...shared, ...block };
    if (block.type === 'plan-csv') return { people: shared.people, ...block };
    return block;
  });
}
