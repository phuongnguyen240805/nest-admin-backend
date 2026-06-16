import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { FastifyRequest } from 'fastify'
import { Repository } from 'typeorm'

import { IAuthUser } from '~/modules/auth/interfaces/auth.interface'
import { Organization } from '~/modules/billing/entities/organization.entity'

import { OrganizationProvisioningService } from './organization-provisioning.service'
import { TenantContextService } from './tenant-context.service'

/**
 * Ensures CLS + request carry organization/tenant context for the current user.
 * Used by TenantGuard (before route handler) and TenantInterceptor.
 */
@Injectable()
export class TenantRequestBootstrapService {
  constructor(
    private readonly organizationProvisioningService: OrganizationProvisioningService,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async ensureRequestTenantContext(request: FastifyRequest): Promise<boolean> {
    if (this.tenantContext.isReady() && request.org) {
      return true
    }

    const user = request.user as IAuthUser | undefined
    if (!user?.uid) {
      return false
    }

    let organizationId = user.organizationId
    let tenantId = user.activeTenantId ?? user.tenantId

    if (!organizationId || tenantId == null) {
      const workspace =
        await this.organizationProvisioningService.ensureWorkspaceForUser(user.uid)
      organizationId = workspace.organizationId
      tenantId = workspace.tenantId
      user.organizationId = organizationId
      user.tenantId = tenantId
      user.activeTenantId = tenantId
    }

    const org =
      (await this.organizationRepository.findOne({
        where: { id: organizationId },
      })) ?? null

    if (!org || tenantId == null) {
      return false
    }

    request.org = org
    request.organization = organizationId
    request.tenantId = tenantId

    this.tenantContext.setContext({
      tenantId,
      organizationId,
      organization: org,
    })

    return true
  }
}