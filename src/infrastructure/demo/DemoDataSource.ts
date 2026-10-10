import type { ForgeSnapshot, SourceKind } from '@domain/entities';
import type { DeliveryDataSource, SourceAvailability } from '@application/ports/DeliveryDataSource';
import { buildDemoSnapshot } from './demoSnapshot';

/** Offline data source backed by the hand-authored demo dataset. */
export class DemoDataSource implements DeliveryDataSource {
  readonly kind: SourceKind = 'demo';
  readonly label = 'Demo Mode';

  availability(): SourceAvailability {
    return { available: true };
  }

  async load(now: Date = new Date()): Promise<ForgeSnapshot> {
    return buildDemoSnapshot(now);
  }
}
