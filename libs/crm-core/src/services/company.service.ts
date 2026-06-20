import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'

import {
  CrmCompanyEntity,
  CrmPersonCompanyEntity,
} from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'
import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { companyNameFromDomain } from '../utils/company-from-domain'
import { getEmailDomain } from '../utils/email-domain'
import { CrmTenantScopedService } from './crm-tenant-scoped.service'

export interface CompanyListQuery {
  page?: number
  pageSize?: number
  search?: string
}

export interface CreateCompanyInput {
  name: string
  domain?: string | null
}

export interface UpdateCompanyInput {
  name?: string
  domain?: string | null
}

@Injectable()
export class CrmCompanyService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmCompanyEntity)
    private readonly companyRepository: Repository<CrmCompanyEntity>,
    @InjectRepository(CrmPersonCompanyEntity)
    private readonly personCompanyRepository: Repository<CrmPersonCompanyEntity>,
  ) {
    super(tenantContext)
  }

  async list(query: CompanyListQuery): Promise<Pagination<CrmCompanyEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.companyRepository
      .createQueryBuilder('company')
      .where('company.tenantId = :tenantId', { tenantId })
      .andWhere('company.deletedAt IS NULL')

    if (query.search) {
      qb.andWhere('company.name ILIKE :search', { search: `%${query.search}%` })
    }

    qb.orderBy('company.createdAt', 'DESC')
    return paginate(qb, { page: query.page, pageSize: query.pageSize })
  }

  async detail(id: string): Promise<CrmCompanyEntity> {
    return this.findOneForTenantOrFail(
      this.companyRepository,
      { id },
      'Company not found',
    )
  }

  async create(input: CreateCompanyInput): Promise<CrmCompanyEntity> {
    return this.companyRepository.save({
      tenantId: this.requireTenantId(),
      name: input.name,
      domain: input.domain ?? null,
    })
  }

  async update(id: string, input: UpdateCompanyInput): Promise<CrmCompanyEntity> {
    const company = await this.detail(id)
    if (input.name !== undefined) company.name = input.name
    if (input.domain !== undefined) company.domain = input.domain
    return this.companyRepository.save(company)
  }

  async remove(id: string): Promise<void> {
    const company = await this.detail(id)
    await this.companyRepository.softRemove(company)
  }

  /**
   * Find company by email domain or create from domain suggestion.
   * Returns null for personal email domains.
   */
  async findOrCreateByEmailDomain(
    email: string | null | undefined,
    manager?: EntityManager,
  ): Promise<CrmCompanyEntity | null> {
    const domain = getEmailDomain(email)
    if (!domain) return null

    const tenantId = this.requireTenantId()
    const companyRepo = manager
      ? manager.getRepository(CrmCompanyEntity)
      : this.companyRepository

    const existing = await companyRepo.findOne({
      where: { tenantId, domain },
    })
    if (existing) return existing

    const suggestedName = companyNameFromDomain(domain)
    if (!suggestedName) return null

    return companyRepo.save({
      tenantId,
      name: suggestedName,
      domain,
    })
  }

  async linkPersonToCompany(
    personId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const tenantId = this.requireTenantId()
    const companyRepo = manager
      ? manager.getRepository(CrmCompanyEntity)
      : this.companyRepository
    const linkRepo = manager
      ? manager.getRepository(CrmPersonCompanyEntity)
      : this.personCompanyRepository

    const company = await companyRepo.findOne({
      where: { tenantId, id: companyId },
    })
    if (!company) {
      throw new NotFoundException('Company not found')
    }

    const existing = await linkRepo.findOne({
      where: { personId, companyId },
    })
    if (existing) return

    await linkRepo.save({
      personId,
      companyId: company.id,
    })
  }
}