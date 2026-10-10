import type { ForgeSnapshot } from '@domain/entities';
import type { DeliveryDataSource, SourceAvailability } from '@application/ports/DeliveryDataSource';

/**
 * Connected mode. The browser never talks to a Git provider nor holds tokens:
 * it will call a Voomp Forge backend that owns provider connectors
 * (GitHub, GitLab, Bitbucket, Azure Repos…) and returns a `ForgeSnapshot`.
 * Disabled until that backend and its authentication exist.
 */
export class RemoteDataSource implements DeliveryDataSource {
  readonly kind = 'connected' as const;
  readonly label = 'Conectado';

  availability(): SourceAvailability {
    return {
      available: false,
      reason: 'Requer o backend Voomp Forge com autenticação e conector Git. Ainda não disponível.',
    };
  }

  async load(): Promise<ForgeSnapshot> {
    throw new Error(this.availability().reason);
  }
}
