import type { ForgeSnapshot, SourceKind } from '@domain/entities';
import type { DeliveryDataSource, SourceAvailability } from '@application/ports/DeliveryDataSource';
import { parseSnapshot } from '@application/contracts/parseSnapshot';

export type SnapshotFileInput = { url: string } | { file: Blob };

/**
 * Reads a periodic snapshot (JSON produced by `npm run ingest` or by a backend job)
 * from a URL or a local file. The browser never talks to the Git provider.
 */
export class SnapshotFileDataSource implements DeliveryDataSource {
  readonly kind: SourceKind = 'imported';
  readonly label = 'Snapshot importado';

  constructor(private readonly input: SnapshotFileInput) {}

  availability(): SourceAvailability {
    return { available: true };
  }

  async load(): Promise<ForgeSnapshot> {
    const text = await this.readText();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('O arquivo de snapshot não é um JSON válido.');
    }
    return parseSnapshot(json);
  }

  private async readText(): Promise<string> {
    if ('file' in this.input) return this.input.file.text();
    const res = await fetch(this.input.url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Não foi possível baixar o snapshot (${res.status} ${res.statusText}).`);
    return res.text();
  }
}
