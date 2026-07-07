import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Organization } from '~/modules/billing/entities/organization.entity'

import { LEGACY_DEFAULT_APP_CODE } from './constants/app-scope.constant'
import { Tenant } from './entities/tenant.entity'

@Injectable()
export class TenantResolutionService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  /**
   * Resolve the tenant row for an organization.
   * Creates a default tenant (handle from org name slug) when missing.
   */
  async resolveTenantForOrganization(
    organizationId: string,
    orgName?: string,
    appCode: string = LEGACY_DEFAULT_APP_CODE,
  ): Promise<Tenant> {
    const existing = await this.tenantRepository.findOne({
      where: { organizationId },
    })

    if (existing) {
      if (appCode && (!existing.appCode || existing.appCode === LEGACY_DEFAULT_APP_CODE)) {
        existing.appCode = appCode
        await this.tenantRepository.save(existing)
      }
      return existing
    }

    let name = orgName
    if (!name) {
      const org = await this.organizationRepository.findOne({
        where: { id: organizationId },
      })
      name = org?.name ?? 'Workspace'
    }

    const handle = await this.ensureUniqueHandle(this.slugifyOrgName(name))

    const tenant = this.tenantRepository.create({
      organizationId,
      appCode,
      name,
      handle,
      status: 'active',
    })

    return this.tenantRepository.save(tenant)
  }

  private slugifyOrgName(name: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100)

    return slug || 'workspace'
  }

  private async ensureUniqueHandle(base: string): Promise<string> {
    let handle = base
    let suffix = 0

    while (await this.tenantRepository.exist({ where: { handle } })) {
      suffix += 1
      handle = `${base}-${suffix}`.slice(0, 100)
    }

    return handle
  }
}