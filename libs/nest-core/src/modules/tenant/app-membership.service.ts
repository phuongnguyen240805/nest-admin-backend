import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { AppScopeConfig, IAppScopeConfig } from '~/config/app-scope.config'
import { Organization } from '~/modules/billing/entities/organization.entity'
import {
  Period,
  Subscription,
  SubscriptionTier,
} from '~/modules/billing/entities/subscription.entity'
import { UserEntity } from '~/modules/user/user.entity'

import {
  APP_CODE_LADIPAGE,
  LEGACY_DEFAULT_APP_CODE,
} from './constants/app-scope.constant'
import { SysAppEntity } from './entities/sys-app.entity'
import { Tenant } from './entities/tenant.entity'
import { UserAppMembershipEntity } from './entities/user-app-membership.entity'
import type { ProvisionedWorkspace } from './organization-provisioning.service'
import { TenantResolutionService } from './tenant-resolution.service'

@Injectable()
export class AppMembershipService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(SysAppEntity)
    private readonly appRepository: Repository<SysAppEntity>,
    @InjectRepository(UserAppMembershipEntity)
    private readonly membershipRepository: Repository<UserAppMembershipEntity>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly tenantResolutionService: TenantResolutionService,
    @Inject(AppScopeConfig.KEY)
    private readonly appScopeConfig: IAppScopeConfig,
  ) {}

  getRuntimeAppCode(): string {
    return this.appScopeConfig.appCode?.trim() || LEGACY_DEFAULT_APP_CODE
  }

  isScopedAuthEnabled(): boolean {
    return this.appScopeConfig.scopedAuthEnabled
  }

  resolveJwtAppCode(jwtAppCode?: string): string {
    return jwtAppCode?.trim() || this.appScopeConfig.legacyAppCode || LEGACY_DEFAULT_APP_CODE
  }

  assertTokenAppMatchesRuntime(jwtAppCode?: string): void {
    if (!this.isScopedAuthEnabled()) {
      return
    }

    const tokenApp = this.resolveJwtAppCode(jwtAppCode)
    const runtimeApp = this.getRuntimeAppCode()

    if (tokenApp !== runtimeApp) {
      throw new ForbiddenException(
        `Token was issued for application "${tokenApp}" but this service is "${runtimeApp}".`,
      )
    }
  }

  /**
   * Resolve or create workspace scoped to (user, appCode).
   * Legacy mode keeps sys_user.organizationId as source of truth and syncs membership.
   */
  async ensureWorkspace(
    userId: number,
    appCode?: string,
    displayName?: string,
  ): Promise<ProvisionedWorkspace & { appCode: string }> {
    const resolvedAppCode = (appCode?.trim() || this.getRuntimeAppCode())

    await this.ensureAppRegistered(resolvedAppCode)

    if (this.isScopedAuthEnabled()) {
      return this.ensureScopedWorkspace(userId, resolvedAppCode, displayName)
    }

    return this.ensureLegacyWorkspaceWithSync(userId, resolvedAppCode, displayName)
  }

  async syncMembershipFromWorkspace(
    userId: number,
    appCode: string,
    workspace: ProvisionedWorkspace,
    role: UserAppMembershipEntity['role'] = 'owner',
  ): Promise<UserAppMembershipEntity> {
    await this.ensureAppRegistered(appCode)

    const existing = await this.membershipRepository.findOne({
      where: { userId, appCode },
    })

    if (existing) {
      if (
        existing.organizationId !== workspace.organizationId
        || existing.tenantId !== workspace.tenantId
      ) {
        existing.organizationId = workspace.organizationId
        existing.tenantId = workspace.tenantId
        existing.status = 1
        return this.membershipRepository.save(existing)
      }
      return existing
    }

    return this.membershipRepository.save(
      this.membershipRepository.create({
        userId,
        appCode,
        organizationId: workspace.organizationId,
        tenantId: workspace.tenantId,
        role,
        status: 1,
      }),
    )
  }

  private async ensureScopedWorkspace(
    userId: number,
    appCode: string,
    displayName?: string,
  ): Promise<ProvisionedWorkspace & { appCode: string }> {
    const existingMembership = await this.membershipRepository.findOne({
      where: { userId, appCode, status: 1 },
      relations: ['organization', 'tenant'],
    })

    if (existingMembership?.organization && existingMembership.tenant) {
      await this.syncUserOrganizationId(userId, existingMembership.organizationId)
      return {
        organizationId: existingMembership.organizationId,
        tenantId: existingMembership.tenantId,
        organization: existingMembership.organization,
        tenant: existingMembership.tenant,
        appCode,
      }
    }

    const user = await this.loadUser(userId)
    const bridged = await this.tryBridgeLegacyWorkspace(user, appCode)
    if (bridged) {
      await this.syncMembershipFromWorkspace(userId, appCode, bridged)
      await this.syncUserOrganizationId(userId, bridged.organizationId)
      return { ...bridged, appCode }
    }

    const created = await this.createWorkspaceForUser(user, appCode, displayName)
    await this.syncMembershipFromWorkspace(userId, appCode, created)
    await this.syncUserOrganizationId(userId, created.organizationId)
    return { ...created, appCode }
  }

  private async ensureLegacyWorkspaceWithSync(
    userId: number,
    appCode: string,
    displayName?: string,
  ): Promise<ProvisionedWorkspace & { appCode: string }> {
    const user = await this.loadUser(userId)

    let workspace: ProvisionedWorkspace

    if (user.organizationId) {
      const organization =
        user.organization
        ?? (await this.organizationRepository.findOne({
          where: { id: user.organizationId },
        }))

      if (!organization) {
        throw new Error(`Organization ${user.organizationId} not found for user ${userId}`)
      }

      const tenant = await this.tenantResolutionService.resolveTenantForOrganization(
        organization.id,
        organization.name,
        appCode,
      )

      workspace = {
        organizationId: organization.id,
        tenantId: tenant.id,
        organization,
        tenant,
      }
    }
    else {
      workspace = await this.createWorkspaceForUser(user, appCode, displayName)
      await this.syncUserOrganizationId(userId, workspace.organizationId)
    }

    await this.syncMembershipFromWorkspace(userId, appCode, workspace)
    return { ...workspace, appCode }
  }

  private async tryBridgeLegacyWorkspace(
    user: UserEntity,
    appCode: string,
  ): Promise<ProvisionedWorkspace | null> {
    if (!user.organizationId) {
      return null
    }

    const legacyApp = this.appScopeConfig.legacyAppCode || LEGACY_DEFAULT_APP_CODE
    if (appCode !== legacyApp && appCode !== APP_CODE_LADIPAGE) {
      return null
    }

    const organization =
      user.organization
      ?? (await this.organizationRepository.findOne({
        where: { id: user.organizationId },
      }))

    if (!organization) {
      return null
    }

    const tenant = await this.tenantResolutionService.resolveTenantForOrganization(
      organization.id,
      organization.name,
      appCode,
    )

    return {
      organizationId: organization.id,
      tenantId: tenant.id,
      organization,
      tenant,
    }
  }

  private async createWorkspaceForUser(
    user: UserEntity,
    appCode: string,
    displayName?: string,
  ): Promise<ProvisionedWorkspace> {
    const orgName = this.resolveOrgName(user, displayName, appCode)

    const organization = await this.organizationRepository.save(
      this.organizationRepository.create({
        name: orgName,
        description: `Workspace for ${user.username} (${appCode})`,
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

    const tenant = await this.tenantResolutionService.resolveTenantForOrganization(
      organization.id,
      organization.name,
      appCode,
    )

    return {
      organizationId: organization.id,
      tenantId: tenant.id,
      organization,
      tenant,
    }
  }

  private async loadUser(userId: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
    })

    if (!user) {
      throw new Error(`User ${userId} not found`)
    }

    return user
  }

  private async syncUserOrganizationId(
    userId: number,
    organizationId: string,
  ): Promise<void> {
    await this.userRepository.update({ id: userId }, { organizationId })
  }

  private resolveOrgName(
    user: UserEntity,
    displayName: string | undefined,
    appCode: string,
  ): string {
    const candidate =
      displayName?.trim()
      || user.nickname?.trim()
      || user.username?.trim()
      || user.email?.split('@')[0]?.trim()

    return candidate ? `${candidate} (${appCode})` : `Workspace ${user.id} (${appCode})`
  }

  private async ensureAppRegistered(appCode: string): Promise<void> {
    const existing = await this.appRepository.findOne({ where: { code: appCode } })
    if (existing) {
      return
    }

    await this.appRepository.save(
      this.appRepository.create({
        code: appCode,
        name: appCode,
        status: 'active',
      }),
    )
  }
}