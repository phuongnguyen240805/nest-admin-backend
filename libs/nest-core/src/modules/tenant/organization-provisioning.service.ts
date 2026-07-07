import { Injectable } from '@nestjs/common'

import { Organization } from '~/modules/billing/entities/organization.entity'

import { AppMembershipService } from './app-membership.service'
import type { Tenant } from './entities/tenant.entity'

export interface ProvisionedWorkspace {
  organizationId: string
  tenantId: number
  organization: Organization
  tenant: Tenant
  appCode?: string
}

/**
 * Ensures every user has a workspace: Organization (billing) + Tenant (business data),
 * scoped per application when APP_SCOPED_AUTH is enabled.
 */
@Injectable()
export class OrganizationProvisioningService {
  constructor(private readonly appMembershipService: AppMembershipService) {}

  /**
   * Return existing workspace or create Organization + free Subscription + Tenant for the user.
   */
  async ensureWorkspaceForUser(
    userId: number,
    displayName?: string,
    appCode?: string,
  ): Promise<ProvisionedWorkspace> {
    return this.appMembershipService.ensureWorkspace(userId, appCode, displayName)
  }
}