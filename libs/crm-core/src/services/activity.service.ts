import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'

import { CrmActivityEntity } from '@liora/database/entities/crm'
import type {
  CrmActivityAction,
  CrmActivityTargetType,
} from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'
import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { CrmTenantScopedService } from './crm-tenant-scoped.service'

export interface LogActivityInput {
  name: string
  action: CrmActivityAction
  targetType: CrmActivityTargetType
  targetId: string
  personId?: string | null
  opportunityId?: string | null
  properties?: Record<string, unknown> | null
}

export interface ActivityListQuery {
  page?: number
  pageSize?: number
  personId?: string
  opportunityId?: string
}

@Injectable()
export class CrmActivityService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmActivityEntity)
    private readonly activityRepository: Repository<CrmActivityEntity>,
  ) {
    super(tenantContext)
  }

  async list(query: ActivityListQuery): Promise<Pagination<CrmActivityEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.tenantId = :tenantId', { tenantId })

    if (query.personId) {
      qb.andWhere('activity.personId = :personId', { personId: query.personId })
    }

    if (query.opportunityId) {
      qb.andWhere('activity.opportunityId = :opportunityId', {
        opportunityId: query.opportunityId,
      })
    }

    qb.orderBy('activity.happensAt', 'DESC')
    return paginate(qb, { page: query.page, pageSize: query.pageSize })
  }

  async log(
    input: LogActivityInput,
    manager?: EntityManager,
  ): Promise<CrmActivityEntity> {
    const repo = manager
      ? manager.getRepository(CrmActivityEntity)
      : this.activityRepository

    return repo.save({
      tenantId: this.requireTenantId(),
      name: input.name,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      personId: input.personId ?? null,
      opportunityId: input.opportunityId ?? null,
      properties: input.properties ?? null,
    })
  }
}