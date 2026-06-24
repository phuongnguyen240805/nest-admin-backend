import { Injectable } from '@nestjs/common';

import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service';
import { mapLadiworkDealRpcItem } from '../../ladiflow-rpc/mappers/ladiwork/deal.mapper';
import { LadiworkSeedStore } from '../data/ladiwork-seed.store';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class LadiworkDealService {
  constructor(private readonly seedStore: LadiworkSeedStore) {}

  listByStage(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    const template = this.seedStore.getDealListTemplate();
    const pipelineId = String(body.pipeline_id ?? template.pipeline_id ?? '');
    const stageId = String(body.pipeline_stage_id ?? template.pipeline_stage_id ?? '');
    const allDeals = this.filterByOwner(this.seedStore.getDeals(), ctx.ownerId);
    const deals = allDeals
      .filter((deal) => !pipelineId || deal.pipeline_id === pipelineId)
      .filter((deal) => !stageId || deal.pipeline_stage_id === stageId)
      .map((deal) => mapLadiworkDealRpcItem(deal));
    const stages = this.findPipelineStages(pipelineId);

    return {
      ...template,
      deals,
      total: deals.length,
      total_page: deals.length > 0 ? 1 : 0,
      hasNext: false,
      stages,
      pipeline_stage_id: stageId || template.pipeline_stage_id,
    };
  }

  getSummary(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    const template = this.seedStore.getDealSummaryTemplate();
    const pipelineId = String(body.pipeline_id ?? template.pipeline_id ?? '');
    const deals = this.filterByOwner(this.seedStore.getDeals(), ctx.ownerId)
      .filter((deal) => !pipelineId || deal.pipeline_id === pipelineId);
    const stages = this.findPipelineStages(pipelineId);
    const stageSummaries = this.buildStageSummaries(stages, deals);
    const totalValue = deals.reduce((sum, deal) => sum + Number(deal.total_value ?? 0), 0);
    const totalWeightedValue = deals.reduce((sum, deal) => sum + Number(deal.weighted_value ?? 0), 0);

    return {
      ...template,
      pipeline_id: pipelineId || template.pipeline_id,
      summary: {
        ...(template.summary as JsonRecord),
        total_deals: deals.length,
        total_value: totalValue,
        total_weighted_value: totalWeightedValue,
        stage_summaries: stageSummaries,
        deal_count: deals.length,
        stage_count: stages.length,
      },
      total_deals: deals.length,
      total_value: totalValue,
      total_weighted_value: totalWeightedValue,
      stage_count: stages.length,
    };
  }

  private findPipelineStages(pipelineId: string): JsonRecord[] {
    const pipeline = this.seedStore.getPipelines().find((item) => item._id === pipelineId)
      ?? this.seedStore.getPipelines()[0];
    return Array.isArray(pipeline?.stages) ? pipeline.stages as JsonRecord[] : [];
  }

  private buildStageSummaries(stages: JsonRecord[], deals: JsonRecord[]): Record<string, JsonRecord> {
    return stages.reduce<Record<string, JsonRecord>>((acc, stage) => {
      const stageId = String(stage._id ?? '');
      const stageDeals = deals.filter((deal) => deal.pipeline_stage_id === stageId);
      acc[stageId] = {
        stage_id: stageId,
        stage_name: stage.name,
        stage_probability: stage.deal_probability,
        total_value: stageDeals.reduce((sum, deal) => sum + Number(deal.total_value ?? 0), 0),
        weighted_value: stageDeals.reduce((sum, deal) => sum + Number(deal.weighted_value ?? 0), 0),
        deal_count: stageDeals.length,
      };
      return acc;
    }, {});
  }

  private filterByOwner(items: JsonRecord[], ownerId?: string): JsonRecord[] {
    if (!ownerId) return items;
    return items.filter((item) => {
      const scopeUsers = Array.isArray(item.scope_users) ? item.scope_users : [];
      return !item.owner_id && scopeUsers.length === 0
        || item.owner_id === ownerId
        || scopeUsers.includes(ownerId);
    });
  }
}
