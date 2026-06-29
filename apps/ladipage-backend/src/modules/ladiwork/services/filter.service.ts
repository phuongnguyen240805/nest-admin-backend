import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service';
import { LadiworkSeedStore } from '../data/ladiwork-seed.store';
import { CrmFilterEntity } from '../entities';

@Injectable()
export class LadiworkFilterService {
  constructor(
    private readonly seedStore: LadiworkSeedStore,
    @Optional()
    @InjectRepository(CrmFilterEntity)
    private readonly filterRepository?: Repository<CrmFilterEntity>,
  ) {}

  getSystemFilters(ctx?: LadiflowRpcContext): unknown {
    if (this.filterRepository) {
      return this.getSystemFiltersFromRepository(ctx) as unknown;
    }

    return this.seedStore.getSystemFilters();
  }

  private async getSystemFiltersFromRepository(ctx?: LadiflowRpcContext): Promise<unknown> {
    const query = this.filterRepository!.createQueryBuilder('filter')
      .where('filter.is_active = true');
    if (ctx?.tenantId != null) {
      query.andWhere('filter.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }
    const filters = await query.orderBy('filter._id', 'ASC').getMany();

    if (filters.length === 0) return ctx?.tenantId == null ? this.seedStore.getSystemFilters() : [];

    return filters.map((filter) => ({
      _id: filter.externalId,
      entity: filter.entity,
      key_name: filter.keyName,
      name: filter.name,
      filter_type: filter.filterType,
      visibility: filter.visibility,
      is_active: filter.isActive,
      is_editable: filter.isEditable,
      is_temporary: filter.isTemporary,
      conditions: filter.conditions,
      'conditions.conditions': filter.conditionsConditions,
      'conditions.glue': filter.conditionsGlue,
    }));
  }
}
