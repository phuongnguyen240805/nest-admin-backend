import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '~/helper/paginate'
import { Pagination } from '~/helper/paginate/pagination'
import { TenantContextService } from '~/modules/tenant/tenant-context.service'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

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
    const field = await this.detail(id)
    await this.valueRepository.delete({ fieldId: id })
    await this.fieldRepository.remove(field)
  }
}