import { ForbiddenException } from '@nestjs/common'

import { Organization } from '~/modules/billing/entities/organization.entity'
import { UserEntity } from '~/modules/user/user.entity'

import { AppMembershipService } from './app-membership.service'
import { APP_CODE_LADIPAGE } from './constants/app-scope.constant'
import { Tenant } from './entities/tenant.entity'
import { UserAppMembershipEntity } from './entities/user-app-membership.entity'

describe('AppMembershipService', () => {
  const appScopeConfig = {
    appCode: APP_CODE_LADIPAGE,
    scopedAuthEnabled: false,
    legacyAppCode: APP_CODE_LADIPAGE,
  }

  const organization = { id: 'org-1', name: 'Acme' } as Organization
  const tenant = { id: 9, organizationId: 'org-1', appCode: APP_CODE_LADIPAGE } as Tenant

  let service: AppMembershipService
  let membershipRepository: {
    findOne: jest.Mock
    save: jest.Mock
    create: jest.Mock
  }

  beforeEach(() => {
    membershipRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (value) => ({ id: 1, ...value })),
      create: jest.fn((value) => value),
    }

    service = new AppMembershipService(
      {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          username: 'demo',
          organizationId: 'org-1',
          organization,
        } as UserEntity),
        update: jest.fn(),
      } as any,
      {
        findOne: jest.fn().mockResolvedValue({ code: APP_CODE_LADIPAGE }),
        save: jest.fn(),
      } as any,
      membershipRepository as any,
      {
        findOne: jest.fn().mockResolvedValue(organization),
        save: jest.fn(),
        create: jest.fn(),
      } as any,
      {
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      } as any,
      {
        resolveTenantForOrganization: jest.fn().mockResolvedValue(tenant),
      } as any,
      appScopeConfig as any,
    )
  })

  it('syncs membership in legacy mode without changing tenant ids', async () => {
    membershipRepository.findOne.mockResolvedValue(null)

    const workspace = await service.ensureWorkspace(7, APP_CODE_LADIPAGE)

    expect(workspace.organizationId).toBe('org-1')
    expect(workspace.tenantId).toBe(9)
    expect(workspace.appCode).toBe(APP_CODE_LADIPAGE)
    expect(membershipRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        appCode: APP_CODE_LADIPAGE,
        organizationId: 'org-1',
        tenantId: 9,
      }),
    )
  })

  it('rejects cross-app tokens when scoped auth is enabled', () => {
    const scoped = new AppMembershipService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        appCode: APP_CODE_LADIPAGE,
        scopedAuthEnabled: true,
        legacyAppCode: APP_CODE_LADIPAGE,
      } as any,
    )

    expect(() => scoped.assertTokenAppMatchesRuntime('nest-admin')).toThrow(ForbiddenException)
  })

  it('returns existing membership workspace in scoped mode', async () => {
    const scoped = new AppMembershipService(
      {
        findOne: jest.fn(),
        update: jest.fn(),
      } as any,
      {
        findOne: jest.fn().mockResolvedValue({ code: APP_CODE_LADIPAGE }),
      } as any,
      {
        findOne: jest.fn().mockResolvedValue({
          userId: 3,
          appCode: APP_CODE_LADIPAGE,
          organizationId: 'org-2',
          tenantId: 11,
          organization: { id: 'org-2', name: 'Scoped' },
          tenant: { id: 11 },
        } as UserAppMembershipEntity),
        save: jest.fn(),
        create: jest.fn(),
      } as any,
      {} as any,
      {} as any,
      { resolveTenantForOrganization: jest.fn() } as any,
      {
        appCode: APP_CODE_LADIPAGE,
        scopedAuthEnabled: true,
        legacyAppCode: APP_CODE_LADIPAGE,
      } as any,
    )

    const workspace = await scoped.ensureWorkspace(3, APP_CODE_LADIPAGE)

    expect(workspace.tenantId).toBe(11)
    expect(workspace.organizationId).toBe('org-2')
  })
})