import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  FindOptionsWhere,
  In,
  ObjectLiteral,
  Repository,
} from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

@Injectable()
export abstract class TenantScopedService {
  constructor(protected readonly tenantContext: TenantContextService) {}

  protected requireTenantId(): number {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null) {
      throw new ForbiddenException('Tenant ID is required')
    }
    return tenantId
  }

  /**
   * Build a tenant-scoped TypeORM predicate.
   *
   * tenantId is deliberately assigned last so a caller can never override the
   * authenticated tenant through an `extra` object. Keep this helper as the
   * single construction point for simple tenant-owned lookups.
   */
  protected tenantWhere<T extends ObjectLiteral>(
    extra?: FindOptionsWhere<T>,
  ): FindOptionsWhere<T> {
    return {
      ...(extra ?? {}),
      tenantId: this.requireTenantId(),
    } as unknown as FindOptionsWhere<T>
  }

  protected async findOneForTenant<T extends { tenantId: number }>(
    repository: Repository<T>,
    where: FindOptionsWhere<T>,
  ): Promise<T | null> {
    return repository.findOne({
      where: this.tenantWhere(where),
    })
  }

  protected async findOneForTenantOrFail<T extends { tenantId: number }>(
    repository: Repository<T>,
    where: FindOptionsWhere<T>,
    message = 'Record not found',
  ): Promise<T> {
    const entity = await this.findOneForTenant(repository, where)
    if (!entity) {
      throw new NotFoundException(message)
    }
    return entity
  }

  /**
   * Validate foreign/relation ids before mutating a mapping table.
   *
   * Mapping tables in the legacy schema do not all carry tenantId themselves,
   * so the referenced tenant-owned rows are the authorization boundary. The
   * check is intentionally performed before delete/insert so an invalid cross-
   * tenant request cannot erase existing valid relations.
   */
  protected async assertTenantOwnedIds<
    T extends ObjectLiteral & { id: number; tenantId: number },
  >(
    repository: Repository<T>,
    ids: readonly number[] | null | undefined,
    message = 'Related resource not found',
  ): Promise<void> {
    if (!ids?.length) return

    const uniqueIds = [
      ...new Set(
        ids.filter(
          (id): id is number => Number.isInteger(id) && id > 0,
        ),
      ),
    ]

    if (uniqueIds.length !== ids.length) {
      throw new NotFoundException(message)
    }

    const count = await repository.count({
      where: this.tenantWhere<T>({
        id: In(uniqueIds),
      } as FindOptionsWhere<T>),
    })

    if (count !== uniqueIds.length) {
      // Deliberately do not distinguish missing from foreign-tenant ids.
      throw new NotFoundException(message)
    }
  }
}
