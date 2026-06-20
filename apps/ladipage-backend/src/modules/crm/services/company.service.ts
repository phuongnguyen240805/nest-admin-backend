import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { assertLpCrmWritable } from '../common/lp-crm-write.guard'
import {
  CompanyQueryDto,
  CreateCompanyDto,
  UpdateCompanyDto,
} from '../dto/company.dto'
import { CompanyEntity } from '../entities'

@Injectable()
export class CompanyService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: CompanyQueryDto): Promise<Pagination<CompanyEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.companyRepository
      .createQueryBuilder('company')
      .where('company.tenantId = :tenantId', { tenantId })

    if (dto.search) {
      qb.andWhere('company.name ILIKE :search', { search: `%${dto.search}%` })
    }

    qb.orderBy('company.createdAt', 'DESC')
    return paginate(qb, { page: dto.page, pageSize: dto.pageSize })
  }

  async detail(id: number) {
    return this.findOneForTenantOrFail(
      this.companyRepository,
      { id },
      'Company not found',
    )
  }

  async create(dto: CreateCompanyDto) {
    assertLpCrmWritable('company')
    return this.companyRepository.save({
      tenantId: this.requireTenantId(),
      name: dto.name,
    })
  }

  async update(id: number, dto: UpdateCompanyDto) {
    assertLpCrmWritable('company')
    const company = await this.detail(id)
    Object.assign(company, dto)
    return this.companyRepository.save(company)
  }

  async remove(id: number) {
    assertLpCrmWritable('company')
    const company = await this.detail(id)
    await this.companyRepository.remove(company)
  }
}