import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'

import {
  CrmDynamicRecordEntity,
  CrmObjectDefinitionEntity,
} from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'
import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { getEnterpriseRecordLimit } from '../config/enterprise.config'
import { validateDynamicRecordData } from '../utils/dynamic-record-validation'
import { CrmObjectDefinitionService } from './object-definition.service'
import { CrmTenantScopedService } from './crm-tenant-scoped.service'

export interface RecordListQuery {
  page?: number
  pageSize?: number
}

export interface CreateRecordInput {
  data: Record<string, unknown>
}

export interface UpdateRecordInput {
  data: Record<string, unknown>
}

@Injectable()
export class CrmDynamicRecordService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmDynamicRecordEntity)
    private readonly recordRepository: Repository<CrmDynamicRecordEntity>,
    @InjectRepository(CrmObjectDefinitionEntity)
    private readonly objectRepository: Repository<CrmObjectDefinitionEntity>,
    private readonly objectDefinitionService: CrmObjectDefinitionService,
  ) {
    super(tenantContext)
  }

  async list(
    objectSlug: string,
    query: RecordListQuery,
  ): Promise<Pagination<CrmDynamicRecordEntity>> {
    const obj = await this.objectDefinitionService.detailBySlug(objectSlug)
    const qb = this.recordRepository
      .createQueryBuilder('rec')
      .where('rec.tenantId = :tenantId', { tenantId: this.requireTenantId() })
      .andWhere('rec.objectId = :objectId', { objectId: obj.id })
      .andWhere('rec.deletedAt IS NULL')
      .orderBy('rec.createdAt', 'DESC')

    return paginate(qb, { page: query.page, pageSize: query.pageSize })
  }

  async detail(objectSlug: string, id: string): Promise<CrmDynamicRecordEntity> {
    const obj = await this.objectDefinitionService.detailBySlug(objectSlug)
    return this.findOneForTenantOrFail(
      this.recordRepository,
      { id, objectId: obj.id },
      'Record not found',
    )
  }

  async countForObject(objectId: string): Promise<number> {
    return this.recordRepository.count({
      where: {
        ...this.tenantWhere(),
        objectId,
        deletedAt: IsNull(),
      },
    })
  }

  async assertRecordQuota(
    objectId: string,
    subscriptionTier: string | null | undefined,
  ): Promise<void> {
    const limit = getEnterpriseRecordLimit(subscriptionTier)
    if (limit === 0) {
      throw new ForbiddenException(
        'CRM custom object records require Enterprise plan or higher',
      )
    }
    if (limit > 0) {
      const count = await this.countForObject(objectId)
      if (count >= limit) {
        throw new ForbiddenException(
          `Record limit reached (${limit} records per object on ${subscriptionTier} plan)`,
        )
      }
    }
  }

  async create(
    objectSlug: string,
    input: CreateRecordInput,
    subscriptionTier?: string | null,
  ): Promise<CrmDynamicRecordEntity> {
    const obj = await this.objectDefinitionService.detailBySlug(objectSlug)
    await this.assertRecordQuota(obj.id, subscriptionTier)

    const fields = obj.fields ?? []
    const data = validateDynamicRecordData(fields, input.data ?? {})

    return this.recordRepository.save({
      tenantId: this.requireTenantId(),
      objectId: obj.id,
      data,
    })
  }

  async update(
    objectSlug: string,
    id: string,
    input: UpdateRecordInput,
  ): Promise<CrmDynamicRecordEntity> {
    const obj = await this.objectDefinitionService.detailBySlug(objectSlug)
    const record = await this.detail(objectSlug, id)
    const fields = obj.fields ?? []
    const data = validateDynamicRecordData(fields, {
      ...record.data,
      ...input.data,
    })

    record.data = data
    return this.recordRepository.save(record)
  }

  async remove(objectSlug: string, id: string): Promise<void> {
    const record = await this.detail(objectSlug, id)
    await this.recordRepository.softRemove(record)
  }
}