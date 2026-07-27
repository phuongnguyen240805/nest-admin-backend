import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { CommerceStoreLinkEntity } from '../entities'

/**
 * Tenant-scoped persistence for the org → Medusa sales-channel link (ADR-005).
 * Every read/write is filtered by tenantId via TenantScopedService, so one
 * tenant can never observe or mutate another tenant's store link.
 */
@Injectable()
export class CommerceStoreLinkService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CommerceStoreLinkEntity)
    private readonly repo: Repository<CommerceStoreLinkEntity>,
  ) {
    super(tenantContext)
  }

  findByOrg(organizationId: string): Promise<CommerceStoreLinkEntity | null> {
    return this.findOneForTenant(this.repo, { organizationId })
  }

  async upsert(
    organizationId: string,
    patch: DeepPartial<CommerceStoreLinkEntity>,
  ): Promise<CommerceStoreLinkEntity> {
    const tenantId = this.requireTenantId()
    const existing = await this.findByOrg(organizationId)
    const merged = this.repo.merge(
      existing ?? this.repo.create({ tenantId, organizationId }),
      { ...patch, tenantId, organizationId },
    )
    return this.repo.save(merged)
  }
}
