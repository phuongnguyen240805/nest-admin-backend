import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'

import { CrmOpportunityEntity } from '@liora/database/entities/crm'
import type { CrmCurrencyAmount } from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'
import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { CrmActivityService } from './activity.service'
import { CrmTenantScopedService } from './crm-tenant-scoped.service'
import { CrmPipelineService } from './pipeline.service'

export interface OpportunityListQuery {
  page?: number
  pageSize?: number
  search?: string
  stageId?: string
  personId?: string
  companyId?: string
}

export interface CreateOpportunityInput {
  name: string
  amount?: CrmCurrencyAmount | null
  closeDate?: string | null
  stageId?: string
  stageSlug?: string
  personId?: string | null
  companyId?: string | null
  position?: number
  ownerId?: number | null
}

export interface UpdateOpportunityInput {
  name?: string
  amount?: CrmCurrencyAmount | null
  closeDate?: string | null
  personId?: string | null
  companyId?: string | null
  position?: number
  ownerId?: number | null
}

@Injectable()
export class CrmOpportunityService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmOpportunityEntity)
    private readonly opportunityRepository: Repository<CrmOpportunityEntity>,
    private readonly pipelineService: CrmPipelineService,
    private readonly activityService: CrmActivityService,
    private readonly dataSource: DataSource,
  ) {
    super(tenantContext)
  }

  async list(
    query: OpportunityListQuery,
  ): Promise<Pagination<CrmOpportunityEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.opportunityRepository
      .createQueryBuilder('opp')
      .leftJoinAndSelect('opp.stage', 'stage')
      .where('opp.tenantId = :tenantId', { tenantId })
      .andWhere('opp.deletedAt IS NULL')

    if (query.search) {
      qb.andWhere('opp.name ILIKE :search', { search: `%${query.search}%` })
    }
    if (query.stageId) {
      qb.andWhere('opp.stageId = :stageId', { stageId: query.stageId })
    }
    if (query.personId) {
      qb.andWhere('opp.personId = :personId', { personId: query.personId })
    }
    if (query.companyId) {
      qb.andWhere('opp.companyId = :companyId', { companyId: query.companyId })
    }

    qb.orderBy('opp.position', 'ASC').addOrderBy('opp.createdAt', 'DESC')
    return paginate(qb, { page: query.page, pageSize: query.pageSize })
  }

  async detail(id: string): Promise<CrmOpportunityEntity> {
    const opp = await this.findOneForTenantOrFail(
      this.opportunityRepository,
      { id },
      'Opportunity not found',
    )
    return this.opportunityRepository.findOne({
      where: { id: opp.id, tenantId: this.requireTenantId() },
      relations: ['stage'],
    }) as Promise<CrmOpportunityEntity>
  }

  async create(input: CreateOpportunityInput): Promise<CrmOpportunityEntity> {
    const tenantId = this.requireTenantId()
    const pipeline = await this.pipelineService.ensureDefaultPipeline()

    let stageId = input.stageId
    if (!stageId && input.stageSlug) {
      const stage = await this.pipelineService.getStageBySlug(input.stageSlug)
      stageId = stage?.id
    }
    if (!stageId) {
      stageId = pipeline.stages[0]?.id
    }
    if (!stageId) {
      throw new BadRequestException('No pipeline stage available')
    }

    return this.dataSource.transaction(async (manager) => {
      const opp = await manager.getRepository(CrmOpportunityEntity).save({
        tenantId,
        name: input.name,
        amount: input.amount ?? null,
        closeDate: input.closeDate ?? null,
        pipelineId: pipeline.id,
        stageId,
        personId: input.personId ?? null,
        companyId: input.companyId ?? null,
        position: input.position ?? 0,
        ownerId: input.ownerId ?? null,
      })

      await this.activityService.log(
        {
          name: `Deal created: ${opp.name}`,
          action: 'CREATED',
          targetType: 'opportunity',
          targetId: opp.id,
          personId: opp.personId,
          opportunityId: opp.id,
          properties: { stageId: opp.stageId },
        },
        manager,
      )

      if (opp.personId) {
        await this.activityService.log(
          {
            name: `New deal: ${opp.name}`,
            action: 'CREATED',
            targetType: 'opportunity',
            targetId: opp.id,
            personId: opp.personId,
            opportunityId: opp.id,
          },
          manager,
        )
      }

      return opp
    })
  }

  async update(
    id: string,
    input: UpdateOpportunityInput,
  ): Promise<CrmOpportunityEntity> {
    const opp = await this.detail(id)

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CrmOpportunityEntity)
      await repo.update(opp.id, {
        name: input.name ?? opp.name,
        amount: input.amount !== undefined ? input.amount : opp.amount,
        closeDate: input.closeDate !== undefined ? input.closeDate : opp.closeDate,
        personId: input.personId !== undefined ? input.personId : opp.personId,
        companyId:
          input.companyId !== undefined ? input.companyId : opp.companyId,
        position: input.position ?? opp.position,
        ownerId: input.ownerId !== undefined ? input.ownerId : opp.ownerId,
      })

      const updated = await repo.findOne({ where: { id: opp.id } })

      await this.activityService.log(
        {
          name: `Deal updated: ${updated!.name}`,
          action: 'UPDATED',
          targetType: 'opportunity',
          targetId: opp.id,
          personId: updated!.personId,
          opportunityId: opp.id,
          properties: { changes: input },
        },
        manager,
      )

      return updated!
    })
  }

  async moveStage(id: string, stageId: string): Promise<CrmOpportunityEntity> {
    const opp = await this.detail(id)
    const stage = await this.pipelineService.getStageById(stageId)

    if (!stage) {
      throw new BadRequestException('Invalid stage')
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CrmOpportunityEntity)
      const previousStageId = opp.stageId

      await repo.update(opp.id, { stageId })

      const updated = await repo.findOne({
        where: { id: opp.id },
        relations: ['stage'],
      })

      await this.activityService.log(
        {
          name: `Deal moved to ${stage.name}`,
          action: 'STAGE_CHANGED',
          targetType: 'opportunity',
          targetId: opp.id,
          personId: opp.personId,
          opportunityId: opp.id,
          properties: {
            fromStageId: previousStageId,
            toStageId: stageId,
            toStageName: stage.name,
          },
        },
        manager,
      )

      return updated!
    })
  }

  async remove(id: string): Promise<void> {
    const opp = await this.detail(id)

    await this.dataSource.transaction(async (manager) => {
      await this.activityService.log(
        {
          name: `Deal deleted: ${opp.name}`,
          action: 'DELETED',
          targetType: 'opportunity',
          targetId: opp.id,
          personId: opp.personId,
          opportunityId: opp.id,
        },
        manager,
      )

      await manager.getRepository(CrmOpportunityEntity).softRemove(opp)
    })
  }
}