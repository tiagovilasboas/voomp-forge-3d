import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDemoSnapshot } from '../demo/demoSnapshot';
import { SnapshotFileDataSource } from './SnapshotFileDataSource';

const json = () => JSON.stringify(buildDemoSnapshot(new Date('2026-01-15T12:00:00Z')));

afterEach(() => vi.unstubAllGlobals());

describe('SnapshotFileDataSource', () => {
  it('loads from a Blob', async () => {
    const ds = new SnapshotFileDataSource({ file: new Blob([json()]) });
    expect(ds.kind).toBe('imported');
    expect((await ds.load()).squads.length).toBeGreaterThan(0);
  });

  it('loads from a URL and reports HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(json())));
    expect((await new SnapshotFileDataSource({ url: 'x' }).load()).repositories.length).toBeGreaterThan(0);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 404, statusText: 'Not Found' })));
    await expect(new SnapshotFileDataSource({ url: 'x' }).load()).rejects.toThrow(/404/);
  });

  it('rejects invalid JSON and invalid snapshots', async () => {
    await expect(new SnapshotFileDataSource({ file: new Blob(['{']) }).load()).rejects.toThrow(/JSON/);
    await expect(new SnapshotFileDataSource({ file: new Blob(['{"schemaVersion":1}']) }).load()).rejects.toThrow(/inválido/);
  });
});
