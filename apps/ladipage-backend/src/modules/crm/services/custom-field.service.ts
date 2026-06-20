import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { assertLpCrmWritable } from '../common/lp-crm-write.guard'
import {
  CreateCustomFieldDto,
  CustomFieldQueryDto,
  UpdateCustomFieldDto,
} from '../dto/custom-field.dto'
import { CustomerCustomFieldEntity, CustomerFieldValueEntity } from '../entities'

@Injectable()
export class CrmCustomFieldService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CustomerCustomFieldEntity)
    private readonly fieldRepository: Repository<CustomerCustomFieldEntity>,
    @InjectRepository(CustomerFieldValueEntity)
    private readonly valueRepository: Repository<CustomerFieldValueEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: CustomFieldQueryDto): Promise<Pagination<CustomerCustomFieldEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.fieldRepository
      .createQueryBuilder('field')
      .where('field.tenantId = :tenantId', { tenantId })
      .orderBy('field.createdAt', 'DESC')

    return paginate(qb, { page: dto.page, pageSize: dto.pageSize })
  }

  async detail(id: number) {
    return this.findOneForTenantOrFail(
      this.fieldRepository,
      { id },
      'Custom field not found',
    )
  }

  async create(dto: CreateCustomFieldDto) {
    assertLpCrmWritable('custom_field')
    return this.fieldRepository.save({
      tenantId: this.requireTenantId(),
      fieldName: dto.fieldName,
      displayName: dto.displayName,
      dataType: dto.dataType,
      description: dto.description ?? null,
      options: dto.options ?? null,
    })
  }

  async update(id: number, dto: UpdateCustomFieldDto) {
    assertLpCrmWritable('custom_field')
    const field = await this.detail(id)
    Object.assign(field, {
      fieldName: dto.fieldName ?? field.fieldName,
      displayName: dto.displayName ?? field.displayName,
      dataType: dto.dataType ?? field.dataType,
      description: dto.description !== undefined ? dto.description : field.description,
      options: dto.options !== undefined ? dto.options : field.options,
    })
    return this.fieldRepository.save(field)
  }

  async remove(id: number) {
    assertLpCrmWritable('custom_field')
    const field = await this.detail(id)
    await this.valueRepository.delete({ fieldId: id })
    await this.fieldRepository.remove(field)
  }
}