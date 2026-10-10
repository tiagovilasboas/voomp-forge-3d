import type { ForgeSnapshot, SourceKind } from '@domain/entities';

export interface SourceAvailability {
  available: boolean;
  /** Human-readable reason when unavailable. */
  reason?: string;
}

/**
 * The only port between the app and the outside world. Implementations live in
 * `infrastructure/` and must return provider-agnostic entities.
 */
export interface DeliveryDataSource {
  readonly kind: SourceKind;
  readonly label: string;
  availability(): SourceAvailability;
  /** `now` is injectable for deterministic tests. */
  load(now?: Date): Promise<ForgeSnapshot>;
}
