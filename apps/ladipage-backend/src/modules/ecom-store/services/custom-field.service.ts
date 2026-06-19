import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { EcomEntityType } from '../common/enums'
import {
  CreateCustomFieldDto,
  CustomFieldQueryDto,
  UpdateCustomFieldDto,
} from '../dto/custom-field.dto'
import { CustomFieldEntity } from '../entities'

@Injectable()
export class EcomCustomFieldService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CustomFieldEntity)
    private readonly fieldRepository: Repository<CustomFieldEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: CustomFieldQueryDto): Promise<Pagination<CustomFieldEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.fieldRepository
      .createQueryBuilder('field')
      .where('field.tenantId = :tenantId', { tenantId })
      .andWhere('field.entityType = :entityType', { entityType: dto.entity })
      .orderBy('field.createdAt', 'DESC')

    return paginate(qb, { page: dto.page, pageSize: dto.pageSize })
  }

  async detail(entity: EcomEntityType, id: number) {
    const field = await this.findOneForTenantOrFail(
      this.fieldRepository,
      { id },
      'Custom field not found',
    )

    if (field.entityType !== entity) {
      const { NotFoundException } = await import('@nestjs/common')
      throw new NotFoundException('Custom field not found')
    }

    return field
  }

  async create(dto: CreateCustomFieldDto) {
    return this.fieldRepository.save({
      tenantId: this.requireTenantId(),
      entityType: dto.entity,
      fieldName: dto.fieldName,
      displayName: dto.displayName,
      dataType: dto.dataType,
      description: dto.description ?? null,
      options: dto.options ?? null,
    })
  }

  async update(entity: EcomEntityType, id: number, dto: UpdateCustomFieldDto) {
    const field = await this.detail(entity, id)
    Object.assign(field, {
      fieldName: dto.fieldName ?? field.fieldName,
      displayName: dto.displayName ?? field.displayName,
      dataType: dto.dataType ?? field.dataType,
      description: dto.description !== undefined ? dto.description : field.description,
      options: dto.options !== undefined ? dto.options : field.options,
    })
    return this.fieldRepository.save(field)
  }

  async remove(entity: EcomEntityType, id: number) {
    const field = await this.detail(entity, id)
    await this.fieldRepository.remove(field)
  }
}