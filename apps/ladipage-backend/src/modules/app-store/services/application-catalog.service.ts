import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { LpApplication } from '@liora/ladipage-types';

import type { RpcContext } from '../../ladipage-rpc/rpc-dispatcher.service';
import { mapApplicationRpcItem } from '../../ladipage-rpc/mappers/landing/application.mapper';
import { ApplicationSeedStore } from '../data/application-seed.store';
import { ApplicationEntity } from '../entities';

@Injectable()
export class ApplicationCatalogService {
  constructor(
    private readonly seedStore: ApplicationSeedStore,
    @Optional()
    @InjectRepository(ApplicationEntity)
    private readonly applicationRepository?: Repository<ApplicationEntity>,
  ) {}

  list(_body: Record<string, unknown>, ctx: RpcContext): LpApplication[] {
    if (this.applicationRepository) {
      return this.listFromRepository(ctx) as unknown as LpApplication[];
    }

    const storeId = ctx.storeId ?? this.seedStore.getStoreId();

    return this.seedStore.listApplications()
      .filter((application) => !storeId || application.store_id === storeId)
      .filter((application) => application.is_delete !== true)
      .map((application) => mapApplicationRpcItem(application));
  }

  private async listFromRepository(ctx: RpcContext): Promise<LpApplication[]> {
    const storeId = ctx.storeId ?? this.seedStore.getStoreId();
    const query = this.applicationRepository!.createQueryBuilder('application')
      .where('application.is_delete = false');

    if (ctx.tenantId != null) {
      query.andWhere('application.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }

    if (storeId) {
      query.andWhere('application.store_id = :storeId', { storeId });
    }

    const applications = await query
      .orderBy('application.statusPin', 'DESC')
      .addOrderBy('application.name', 'ASC')
      .getMany();

    if (applications.length === 0 && ctx.tenantId == null) {
      return this.seedStore.listApplications()
        .filter((application) => !storeId || application.store_id === storeId)
        .filter((application) => application.is_delete !== true)
        .map((application) => mapApplicationRpcItem(application));
    }

    return applications.map((application) => mapApplicationRpcItem(application as unknown as Record<string, unknown>));
  }
}
