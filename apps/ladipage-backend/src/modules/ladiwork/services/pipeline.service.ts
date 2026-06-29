import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service';
import { mapLadiworkPipelineRpcItem } from '../../ladiflow-rpc/mappers/ladiwork/pipeline.mapper';
import { LadiworkSeedStore } from '../data/ladiwork-seed.store';
import { CrmPipelineEntity } from '../entities';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class LadiworkPipelineService {
  constructor(
    private readonly seedStore: LadiworkSeedStore,
    @Optional()
    @InjectRepository(CrmPipelineEntity)
    private readonly pipelineRepository?: Repository<CrmPipelineEntity>,
  ) {}

  list(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    if (this.pipelineRepository) {
      return this.listFromRepository(body, ctx) as unknown as JsonRecord;
    }

    const limit = this.positiveNumber(body.limit, 100);
    const page = this.positiveNumber(body.page, 1);
    const pipelines = this.filterByOwner(this.seedStore.getPipelines(), ctx.ownerId)
      .filter((pipeline) => pipeline.is_delete !== true)
      .map((pipeline) => mapLadiworkPipelineRpcItem(pipeline));
    const start = (page - 1) * limit;

    return {
      total: pipelines.length,
      limit,
      items: pipelines.slice(start, start + limit),
    };
  }

  search(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    if (this.pipelineRepository) {
      return this.searchFromRepository(body, ctx) as unknown as JsonRecord;
    }

    const data = this.seedStore.getPipelineSearchData();
    const groups = Array.isArray(data.groups) ? data.groups : [];
    const keyword = String(body.search ?? body.keyword ?? body.key_word ?? '').trim().toLowerCase();

    return {
      ...data,
      groups: groups.map((group) => {
        const groupRecord = group as JsonRecord;
        const pipelines = Array.isArray(groupRecord.pipelines) ? groupRecord.pipelines as JsonRecord[] : [];
        const filtered = this.filterByOwner(pipelines, ctx.ownerId)
          .filter((pipeline) => this.matchesKeyword(pipeline, keyword))
          .map((pipeline) => mapLadiworkPipelineRpcItem(pipeline));

        return {
          ...groupRecord,
          pipelines: filtered,
          count: filtered.length,
        };
      }),
    };
  }

  private filterByOwner(items: JsonRecord[], ownerId?: string): JsonRecord[] {
    if (!ownerId) return items;
    return items.filter((item) => !item.owner_id || item.owner_id === ownerId);
  }

  private matchesKeyword(item: JsonRecord, keyword: string): boolean {
    if (!keyword) return true;
    return String(item.name ?? '').toLowerCase().includes(keyword)
      || String(item.alias ?? '').toLowerCase().includes(keyword);
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private async listFromRepository(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const limit = this.positiveNumber(body.limit, 100);
    const page = this.positiveNumber(body.page, 1);
    const query = this.pipelineRepository!.createQueryBuilder('pipeline')
      .where('pipeline.is_delete = false');

    if (ctx.tenantId != null) {
      query.andWhere('pipeline.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }

    if (ctx.ownerId) {
      query.andWhere('(pipeline.owner_id = :ownerId OR pipeline.scope_type = :publicScope)', {
        ownerId: ctx.ownerId,
        publicScope: 'PUBLIC',
      });
    }

    const [pipelines, total] = await query
      .orderBy('pipeline.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (total === 0 && ctx.tenantId == null) {
      return this.listFromSeed(body, ctx);
    }

    return {
      total,
      limit,
      items: pipelines.map((pipeline) =>
        mapLadiworkPipelineRpcItem(pipeline as unknown as JsonRecord)),
    };
  }

  private async searchFromRepository(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const data = this.seedStore.getPipelineSearchData();
    const keyword = String(body.search ?? body.keyword ?? body.key_word ?? '').trim().toLowerCase();
    const query = this.pipelineRepository!.createQueryBuilder('pipeline')
      .where('pipeline.is_delete = false');

    if (ctx.tenantId != null) {
      query.andWhere('pipeline.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }

    if (ctx.ownerId) {
      query.andWhere('(pipeline.owner_id = :ownerId OR pipeline.scope_type = :publicScope)', {
        ownerId: ctx.ownerId,
        publicScope: 'PUBLIC',
      });
    }

    if (keyword) {
      query.andWhere('(LOWER(pipeline.name) LIKE :keyword OR LOWER(pipeline.alias) LIKE :keyword)', {
        keyword: `%${keyword}%`,
      });
    }

    const pipelines = await query.orderBy('pipeline.name', 'ASC').getMany();
    if (pipelines.length === 0 && ctx.tenantId == null) {
      return this.searchFromSeed(body, ctx);
    }

    return {
      ...data,
      groups: [{
        pipelines: pipelines.map((pipeline) =>
          mapLadiworkPipelineRpcItem(pipeline as unknown as JsonRecord)),
        count: pipelines.length,
        category_id: null,
      }],
    };
  }

  private listFromSeed(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    const limit = this.positiveNumber(body.limit, 100);
    const page = this.positiveNumber(body.page, 1);
    const pipelines = this.filterByOwner(this.seedStore.getPipelines(), ctx.ownerId)
      .filter((pipeline) => pipeline.is_delete !== true)
      .map((pipeline) => mapLadiworkPipelineRpcItem(pipeline));
    const start = (page - 1) * limit;

    return {
      total: pipelines.length,
      limit,
      items: pipelines.slice(start, start + limit),
    };
  }

  private searchFromSeed(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    const data = this.seedStore.getPipelineSearchData();
    const groups = Array.isArray(data.groups) ? data.groups : [];
    const keyword = String(body.search ?? body.keyword ?? body.key_word ?? '').trim().toLowerCase();

    return {
      ...data,
      groups: groups.map((group) => {
        const groupRecord = group as JsonRecord;
        const pipelines = Array.isArray(groupRecord.pipelines) ? groupRecord.pipelines as JsonRecord[] : [];
        const filtered = this.filterByOwner(pipelines, ctx.ownerId)
          .filter((pipeline) => this.matchesKeyword(pipeline, keyword))
          .map((pipeline) => mapLadiworkPipelineRpcItem(pipeline));

        return {
          ...groupRecord,
          pipelines: filtered,
          count: filtered.length,
        };
      }),
    };
  }
}
