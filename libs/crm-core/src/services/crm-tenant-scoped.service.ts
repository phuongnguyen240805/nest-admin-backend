import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

export abstract class CrmTenantScopedService {
  constructor(protected readonly tenantContext: TenantContextService) {}

  protected requireTenantId(): number {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null) {
      throw new ForbiddenException('Tenant ID is required')
    }
    return tenantId
  }

  protected tenantWhere<T extends ObjectLiteral>(
    extra?: FindOptionsWhere<T>,
  ): FindOptionsWhere<T> {
    return {
      tenantId: this.requireTenantId(),
      ...extra,
    } as FindOptionsWhere<T>
  }

  protected async findOneForTenant<T extends { tenantId: number }>(
    repository: Repository<T>,
    where: FindOptionsWhere<T>,
  ): Promise<T | null> {
    return repository.findOne({ where: this.tenantWhere(where) })
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
}