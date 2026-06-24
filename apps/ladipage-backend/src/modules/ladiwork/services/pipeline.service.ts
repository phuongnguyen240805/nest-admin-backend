import { Injectable } from '@nestjs/common';

import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service';
import { mapLadiworkPipelineRpcItem } from '../../ladiflow-rpc/mappers/ladiwork/pipeline.mapper';
import { LadiworkSeedStore } from '../data/ladiwork-seed.store';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class LadiworkPipelineService {
  constructor(private readonly seedStore: LadiworkSeedStore) {}

  list(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
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
}
