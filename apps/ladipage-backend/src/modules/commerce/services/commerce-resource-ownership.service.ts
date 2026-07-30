import { ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { CommerceResourceOwnershipEntity } from '../entities/commerce-resource-ownership.entity'
import type { CommerceResourceKind } from './commerce-admin-resource.service'

@Injectable()
export class CommerceResourceOwnershipService extends TenantScopedService {
  private readonly appId =
    process.env.COMMERCE_OWNERSHIP_APP_ID?.trim() || 'ladipage'

  private readonly environment =
    process.env.COMMERCE_OWNERSHIP_ENV?.trim()
    || process.env.NODE_ENV?.trim()
    || 'development'

  private readonly providerId =
    process.env.COMMERCE_OWNERSHIP_PROVIDER_ID?.trim() || 'medusa-primary'

  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CommerceResourceOwnershipEntity)
    private readonly repo: Repository<CommerceResourceOwnershipEntity>,
  ) {
    super(tenantContext)
  }

  async listExternalIds(
    organizationId: string,
    resourceKind: CommerceResourceKind,
  ): Promise<string[]> {
    const rows = await this.repo.find({
      where: this.tenantWhere({
        appId: this.appId,
        environment: this.environment,
        providerId: this.providerId,
        organizationId,
        resourceKind,
      }),
      select: { externalId: true },
    })
    return rows.map(row => row.externalId)
  }

  async owns(
    organizationId: string,
    resourceKind: CommerceResourceKind,
    externalId: string,
  ): Promise<boolean> {
    return Boolean(await this.findOneForTenant(this.repo, {
      appId: this.appId,
      environment: this.environment,
      providerId: this.providerId,
      organizationId,
      resourceKind,
      externalId,
    }))
  }

  async claim(
    organizationId: string,
    resourceKind: CommerceResourceKind,
    externalId: string,
  ): Promise<void> {
    const tenantId = this.requireTenantId()
    const globalOwner = await this.repo.findOne({
      where: {
        environment: this.environment,
        providerId: this.providerId,
        resourceKind,
        externalId,
      },
    })

    if (globalOwner) {
      if (
        globalOwner.tenantId === tenantId
        && globalOwner.appId === this.appId
        && globalOwner.organizationId === organizationId
      ) {
        return
      }
      throw new ConflictException('Commerce resource is already owned')
    }

    await this.repo.save(this.repo.create({
      tenantId,
      appId: this.appId,
      environment: this.environment,
      providerId: this.providerId,
      organizationId,
      resourceKind,
      externalId,
    }))
  }

  async release(
    organizationId: string,
    resourceKind: CommerceResourceKind,
    externalId: string,
  ): Promise<void> {
    await this.repo.delete(this.tenantWhere({
      appId: this.appId,
      environment: this.environment,
      providerId: this.providerId,
      organizationId,
      resourceKind,
      externalId,
    }))
  }
}
