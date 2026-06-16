import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Organization } from '~/modules/billing/entities/organization.entity'
import {
  Period,
  Subscription,
  SubscriptionTier,
} from '~/modules/billing/entities/subscription.entity'
import { UserEntity } from '~/modules/user/user.entity'

import { Tenant } from './entities/tenant.entity'
import { TenantResolutionService } from './tenant-resolution.service'

export interface ProvisionedWorkspace {
  organizationId: string
  tenantId: number
  organization: Organization
  tenant: Tenant
}

/**
 * Ensures every user has a 1:1 workspace: Organization (billing) + Tenant (business data).
 */
@Injectable()
export class OrganizationProvisioningService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly tenantResolutionService: TenantResolutionService,
  ) {}

  /**
   * Return existing workspace or create Organization + free Subscription + Tenant for the user.
   */
  async ensureWorkspaceForUser(
    userId: number,
    displayName?: string,
  ): Promise<ProvisionedWorkspace> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
    })

    if (!user) {
      throw new Error(`User ${userId} not found`)
    }

    if (user.organizationId) {
      const organization =
        user.organization ??
        (await this.organizationRepository.findOne({
          where: { id: user.organizationId },
        }))

      if (!organization) {
        throw new Error(`Organization ${user.organizationId} not found for user ${userId}`)
      }

      const tenant = await this.tenantResolutionService.resolveTenantForOrganization(
        organization.id,
        organization.name,
      )

      return {
        organizationId: organization.id,
        tenantId: tenant.id,
        organization,
        tenant,
      }
    }

    const orgName = this.resolveOrgName(user, displayName)

    const organization = await this.organizationRepository.save(
      this.organizationRepository.create({
        name: orgName,
        description: `Workspace for ${user.username}`,
        allowTrial: true,
      }),
    )

    const existingSubscription = await this.subscriptionRepository.findOne({
      where: { organizationId: organization.id },
    })

    if (!existingSubscription) {
      await this.subscriptionRepository.save(
        this.subscriptionRepository.create({
          organizationId: organization.id,
          subscriptionTier: SubscriptionTier.FREE,
          period: Period.MONTHLY,
        }),
      )
    }

    await this.userRepository.update({ id: user.id }, { organizationId: organization.id })

    const tenant = await this.tenantResolutionService.resolveTenantForOrganization(
      organization.id,
      organization.name,
    )

    return {
      organizationId: organization.id,
      tenantId: tenant.id,
      organization,
      tenant,
    }
  }

  private resolveOrgName(user: UserEntity, displayName?: string): string {
    const candidate =
      displayName?.trim() ||
      user.nickname?.trim() ||
      user.username?.trim() ||
      user.email?.split('@')[0]?.trim()

    return candidate || `Workspace ${user.id}`
  }
}