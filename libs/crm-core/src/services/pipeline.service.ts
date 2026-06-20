import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import {
  CrmPipelineEntity,
  CrmPipelineStageEntity,
  DEFAULT_PIPELINE_STAGES,
} from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'

import { CrmTenantScopedService } from './crm-tenant-scoped.service'

export interface PipelineWithStages extends CrmPipelineEntity {
  stages: CrmPipelineStageEntity[]
}

@Injectable()
export class CrmPipelineService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmPipelineEntity)
    private readonly pipelineRepository: Repository<CrmPipelineEntity>,
    @InjectRepository(CrmPipelineStageEntity)
    private readonly stageRepository: Repository<CrmPipelineStageEntity>,
  ) {
    super(tenantContext)
  }

  /**
   * Lazy seed: ensure default sales pipeline exists for tenant (on first access).
   */
  async ensureDefaultPipeline(): Promise<PipelineWithStages> {
    const tenantId = this.requireTenantId()

    const existing = await this.pipelineRepository.findOne({
      where: { tenantId, isDefault: true },
      relations: ['stages'],
    })

    if (existing?.stages?.length) {
      return {
        ...existing,
        stages: [...existing.stages].sort((a, b) => a.position - b.position),
      }
    }

    const pipeline = await this.pipelineRepository.save({
      tenantId,
      name: 'Sales Pipeline',
      isDefault: true,
    })

    const stages = await this.stageRepository.save(
      DEFAULT_PIPELINE_STAGES.map((s) => ({
        pipelineId: pipeline.id,
        slug: s.slug,
        name: s.name,
        position: s.position,
        color: s.color,
      })),
    )

    return { ...pipeline, stages }
  }

  async getDefaultPipeline(): Promise<PipelineWithStages> {
    return this.ensureDefaultPipeline()
  }

  async getStageById(stageId: string): Promise<CrmPipelineStageEntity | null> {
    const pipeline = await this.ensureDefaultPipeline()
    return pipeline.stages.find((s) => s.id === stageId) ?? null
  }

  async getStageBySlug(slug: string): Promise<CrmPipelineStageEntity | null> {
    const pipeline = await this.ensureDefaultPipeline()
    return pipeline.stages.find((s) => s.slug === slug) ?? null
  }
}