import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LpLadiworkDashboard } from '@liora/ladipage-types';

import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service';
import { mapLadiworkDashboardRpcItem } from '../../ladiflow-rpc/mappers/ladiwork/dashboard.mapper';
import { LadiworkSeedStore } from '../data/ladiwork-seed.store';
import { CrmDealEntity, CrmPipelineEntity, LadiworkDashboardEntity } from '../entities';

@Injectable()
export class LadiworkDashboardService {
  constructor(
    private readonly seedStore: LadiworkSeedStore,
    @Optional()
    @InjectRepository(LadiworkDashboardEntity)
    private readonly dashboardRepository?: Repository<LadiworkDashboardEntity>,
    @Optional()
    @InjectRepository(CrmPipelineEntity)
    private readonly pipelineRepository?: Repository<CrmPipelineEntity>,
    @Optional()
    @InjectRepository(CrmDealEntity)
    private readonly dealRepository?: Repository<CrmDealEntity>,
  ) {}

  config(ctx?: LadiflowRpcContext): LpLadiworkDashboard {
    if (this.dashboardRepository) {
      return this.configFromRepository(ctx) as unknown as LpLadiworkDashboard;
    }

    return mapLadiworkDashboardRpcItem(this.seedStore.getDashboardConfig());
  }

  attentionStats(ctx?: LadiflowRpcContext): Record<string, unknown> {
    if (this.pipelineRepository && this.dealRepository) {
      return this.attentionStatsFromRepository(ctx) as unknown as Record<string, unknown>;
    }

    return this.seedStore.getDashboardAttentionStats();
  }

  listPipelines(ctx?: LadiflowRpcContext): Record<string, unknown> {
    if (this.pipelineRepository) {
      return this.listPipelinesFromRepository(ctx) as unknown as Record<string, unknown>;
    }

    return this.seedStore.getDashboardListPipelines();
  }

  pipelineByStage(body: Record<string, unknown>, ctx?: LadiflowRpcContext): Record<string, unknown> {
    if (this.pipelineRepository && this.dealRepository) {
      return this.pipelineByStageFromRepository(body, ctx) as unknown as Record<string, unknown>;
    }

    return this.seedStore.getDashboardPipelineByStage();
  }

  private async configFromRepository(ctx?: LadiflowRpcContext): Promise<Record<string, unknown>> {
    const query = this.dashboardRepository!.createQueryBuilder('dashboard');
    if (ctx?.tenantId != null) {
      query.where('dashboard.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }
    const widgets = await query.orderBy('dashboard.order', 'ASC').getMany();

    if (widgets.length === 0) {
      return ctx?.tenantId == null ? this.seedStore.getDashboardConfig() : { widgets: [] };
    }

    return {
      widgets: widgets.map((widget) =>
        mapLadiworkDashboardRpcItem(widget as unknown as Record<string, unknown>)),
    };
  }

  private async attentionStatsFromRepository(ctx?: LadiflowRpcContext): Promise<Record<string, unknown>> {
    const query = this.pipelineRepository!.createQueryBuilder('pipeline')
      .where('pipeline.is_delete = false');
    if (ctx?.tenantId != null) {
      query.andWhere('pipeline.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }
    const pipelines = await query.orderBy('pipeline.name', 'ASC').getMany();

    if (pipelines.length === 0) {
      return ctx?.tenantId == null
        ? this.seedStore.getDashboardAttentionStats()
        : { overdue_jobs: 0, inactive_deals: 0, overdue_deals: 0, pipelines: [] };
    }

    return {
      overdue_jobs: 0,
      inactive_deals: 0,
      overdue_deals: 0,
      pipelines: pipelines.map((pipeline) => ({
        _id: pipeline.externalId,
        name: pipeline.name,
      })),
    };
  }

  private async listPipelinesFromRepository(ctx?: LadiflowRpcContext): Promise<Record<string, unknown>> {
    const query = this.pipelineRepository!.createQueryBuilder('pipeline')
      .where('pipeline.is_delete = false');
    if (ctx?.tenantId != null) {
      query.andWhere('pipeline.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }
    const pipelines = await query.orderBy('pipeline.name', 'ASC').getMany();

    if (pipelines.length === 0) {
      return ctx?.tenantId == null ? this.seedStore.getDashboardListPipelines() : { pipelines: [] };
    }

    return {
      pipelines: pipelines.map((pipeline) => ({
        _id: pipeline.externalId,
        name: pipeline.name,
        type: pipeline.type,
        stages: Array.isArray(pipeline.stages)
          ? pipeline.stages.map((stage: Record<string, unknown>) => ({
            _id: stage._id,
            name: stage.name,
            pipeline_id: stage.pipeline_id ?? pipeline.externalId,
            order_number: stage.order_number,
            stage_color: stage.stage_color ?? null,
          }))
          : [],
      })),
    };
  }

  private async pipelineByStageFromRepository(
    body: Record<string, unknown>,
    ctx?: LadiflowRpcContext,
  ): Promise<Record<string, unknown>> {
    const pipelineId = String(body.pipeline_id ?? '');
    const query = this.pipelineRepository!.createQueryBuilder('pipeline')
      .where('pipeline.is_delete = false');
    if (ctx?.tenantId != null) {
      query.andWhere('pipeline.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }
    if (pipelineId) {
      query.andWhere('pipeline._id = :pipelineId', { pipelineId });
    }
    const pipeline = await query.getOne();

    if (!pipeline) {
      return ctx?.tenantId == null
        ? this.seedStore.getDashboardPipelineByStage()
        : { stages: [], total_value: 0 };
    }

    const stages = Array.isArray(pipeline.stages) ? pipeline.stages as Record<string, unknown>[] : [];
    const dealQuery = this.dealRepository!.createQueryBuilder('deal')
      .where('deal.pipeline_id = :pipelineId', { pipelineId: pipeline.externalId });
    if (ctx?.tenantId != null) {
      dealQuery.andWhere('deal.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }
    const deals = await dealQuery.getMany();
    const stageRows = stages.map((stage) => {
      const stageId = String(stage._id ?? '');
      const stageDeals = deals.filter((deal) => deal.pipelineStageId === stageId);
      return {
        stage_id: stageId,
        stage_name: stage.name,
        count: stageDeals.length,
        total_value: stageDeals.reduce((sum, deal) => sum + Number(deal.totalValue ?? 0), 0),
      };
    }).filter((stage) => stage.count > 0);

    return {
      stages: stageRows,
      total_value: stageRows.reduce((sum, stage) => sum + Number(stage.total_value ?? 0), 0),
    };
  }
}
