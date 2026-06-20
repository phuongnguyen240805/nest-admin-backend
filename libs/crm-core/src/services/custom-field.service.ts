import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'

import {
  CrmCustomFieldDefEntity,
  CrmCustomFieldValueEntity,
} from '@liora/database/entities/crm'
import type {
  CrmCustomFieldDataType,
  CrmCustomFieldTargetType,
} from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'
import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { getCustomFieldLimit } from '../config/custom-field.config'
import {
  normalizeFieldName,
  validateCustomFieldDef,
  validateCustomFieldValue,
} from '../utils/custom-field-validation'
import { CrmTenantScopedService } from './crm-tenant-scoped.service'

export interface CustomFieldListQuery {
  page?: number
  pageSize?: number
  targetType?: CrmCustomFieldTargetType
}

export interface CreateCustomFieldDefInput {
  targetType?: CrmCustomFieldTargetType
  fieldName: string
  displayName: string
  dataType?: CrmCustomFieldDataType
  description?: string | null
  options?: string[] | null
  isRequired?: boolean
}

export interface UpdateCustomFieldDefInput {
  displayName?: string
  dataType?: CrmCustomFieldDataType
  description?: string | null
  options?: string[] | null
  isRequired?: boolean
}

export interface SetCustomFieldValueInput {
  fieldId: string
  personId?: string | null
  opportunityId?: string | null
  value?: string | null
}

@Injectable()
export class CrmCustomFieldService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmCustomFieldDefEntity)
    private readonly defRepository: Repository<CrmCustomFieldDefEntity>,
    @InjectRepository(CrmCustomFieldValueEntity)
    private readonly valueRepository: Repository<CrmCustomFieldValueEntity>,
  ) {
    super(tenantContext)
  }

  async list(
    query: CustomFieldListQuery,
  ): Promise<Pagination<CrmCustomFieldDefEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.defRepository
      .createQueryBuilder('field')
      .where('field.tenantId = :tenantId', { tenantId })
      .andWhere('field.deletedAt IS NULL')

    if (query.targetType) {
      qb.andWhere('field.targetType = :targetType', {
        targetType: query.targetType,
      })
    }

    qb.orderBy('field.createdAt', 'DESC')
    return paginate(qb, { page: query.page, pageSize: query.pageSize })
  }

  async detail(id: string): Promise<CrmCustomFieldDefEntity> {
    return this.findOneForTenantOrFail(
      this.defRepository,
      { id },
      'Custom field not found',
    )
  }

  async countActive(targetType?: CrmCustomFieldTargetType): Promise<number> {
    const where = {
      ...this.tenantWhere(),
      deletedAt: IsNull(),
      ...(targetType ? { targetType } : {}),
    }
    return this.defRepository.count({ where })
  }

  async assertQuota(subscriptionTier: string | null | undefined): Promise<void> {
    const limit = getCustomFieldLimit(subscriptionTier)
    if (limit === 0) {
      throw new ForbiddenException(
        'CRM custom fields require Pro plan or higher',
      )
    }
    if (limit > 0) {
      const count = await this.countActive()
      if (count >= limit) {
        throw new ForbiddenException(
          `Custom field limit reached (${limit} fields on ${subscriptionTier} plan)`,
        )
      }
    }
  }

  async create(
    input: CreateCustomFieldDefInput,
    subscriptionTier?: string | null,
  ): Promise<CrmCustomFieldDefEntity> {
    await this.assertQuota(subscriptionTier)
    validateCustomFieldDef(input)

    const fieldName = normalizeFieldName(input.fieldName)

    return this.defRepository.save({
      tenantId: this.requireTenantId(),
      targetType: input.targetType ?? 'person',
      fieldName,
      displayName: input.displayName.trim(),
      dataType: input.dataType ?? 'TEXT',
      description: input.description ?? null,
      options: input.options ?? null,
      isRequired: input.isRequired ?? false,
    })
  }

  async update(
    id: string,
    input: UpdateCustomFieldDefInput,
  ): Promise<CrmCustomFieldDefEntity> {
    const field = await this.detail(id)

    if (input.dataType === 'LIST' || field.dataType === 'LIST') {
      const options = input.options !== undefined ? input.options : field.options
      const dataType = input.dataType ?? field.dataType
      validateCustomFieldDef({
        fieldName: field.fieldName,
        displayName: input.displayName ?? field.displayName,
        dataType,
        options,
      })
    }

    Object.assign(field, {
      displayName: input.displayName ?? field.displayName,
      dataType: input.dataType ?? field.dataType,
      description:
        input.description !== undefined ? input.description : field.description,
      options: input.options !== undefined ? input.options : field.options,
      isRequired: input.isRequired ?? field.isRequired,
    })

    return this.defRepository.save(field)
  }

  async remove(id: string): Promise<void> {
    const field = await this.detail(id)
    await this.valueRepository.delete({ fieldId: id })
    await this.defRepository.softRemove(field)
  }

  async setValue(input: SetCustomFieldValueInput): Promise<CrmCustomFieldValueEntity> {
    const field = await this.detail(input.fieldId)

    if (!input.personId && !input.opportunityId) {
      throw new BadRequestException('personId or opportunityId is required')
    }

    if (field.targetType === 'person' && !input.personId) {
      throw new BadRequestException('personId is required for person fields')
    }

    if (field.targetType === 'opportunity' && !input.opportunityId) {
      throw new BadRequestException(
        'opportunityId is required for opportunity fields',
      )
    }

    validateCustomFieldValue(
      field.dataType,
      input.value,
      field.options,
      field.isRequired,
    )

    const where = {
      fieldId: field.id,
      ...(input.personId ? { personId: input.personId } : {}),
      ...(input.opportunityId ? { opportunityId: input.opportunityId } : {}),
    }

    const existing = await this.valueRepository.findOne({ where })

    if (existing) {
      existing.value = input.value ?? null
      return this.valueRepository.save(existing)
    }

    return this.valueRepository.save({
      fieldId: field.id,
      personId: input.personId ?? null,
      opportunityId: input.opportunityId ?? null,
      value: input.value ?? null,
    })
  }

  async getValuesForPerson(personId: string): Promise<CrmCustomFieldValueEntity[]> {
    return this.valueRepository.find({
      where: { personId },
      relations: ['field'],
    })
  }
}