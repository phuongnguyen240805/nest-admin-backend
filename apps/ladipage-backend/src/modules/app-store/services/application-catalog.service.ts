import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { LpApplication } from '@liora/ladipage-types';

import type { RpcContext } from '../../ladipage-rpc/rpc-dispatcher.service';
import { mapApplicationRpcItem } from '../../ladipage-rpc/mappers/landing/application.mapper';
import {
  buildAppStoreScopeKey,
  resolveAppStoreOwnerId,
  resolveAppStoreTenantId,
} from '../app-store-context.util';
import { ApplicationSeedStore } from '../data/application-seed.store';
import { ApplicationEntity } from '../entities';
import { ApplicationAccessService } from './application-access.service';

@Injectable()
export class ApplicationCatalogService {
  constructor(
    private readonly seedStore: ApplicationSeedStore,
    private readonly accessService: ApplicationAccessService,
    @Optional()
    @InjectRepository(ApplicationEntity)
    private readonly applicationRepository?: Repository<ApplicationEntity>,
  ) {}

  async list(_body: Record<string, unknown>, ctx: RpcContext): Promise<LpApplication[]> {
    const tenantId = resolveAppStoreTenantId(ctx);
    const ownerId = resolveAppStoreOwnerId(ctx);

    if (this.applicationRepository) {
      return this.accessService.enrichList(await this.listFromRepository(ctx, tenantId, ownerId), ctx);
    }

    const storeId = ctx.storeId ?? this.seedStore.getStoreId();
    const scopeKey = buildAppStoreScopeKey(tenantId, ownerId, storeId);

    const applications = this.seedStore.listApplications(scopeKey)
      .filter((application) => !storeId || application.store_id === storeId)
      .filter((application) => application.is_delete !== true)
      .map((application) => mapApplicationRpcItem(application));

    return this.accessService.enrichList(applications, ctx);
  }

  private async listFromRepository(
    ctx: RpcContext,
    tenantId: number,
    ownerId: string,
  ): Promise<LpApplication[]> {
    const storeId = ctx.storeId ?? this.seedStore.getStoreId();
    const scopeKey = buildAppStoreScopeKey(tenantId, ownerId, storeId);
    const query = this.applicationRepository!.createQueryBuilder('application')
      .where('application.is_delete = false')
      .andWhere('application.tenantId = :tenantId', { tenantId });

    if (storeId) {
      query.andWhere('application.store_id = :storeId', { storeId });
    }

    const applications = await query
      .orderBy('application.statusPin', 'DESC')
      .addOrderBy('application.name', 'ASC')
      .getMany();

    const mappedApplications = applications.map((application) =>
      mapApplicationRpcItem(application as unknown as Record<string, unknown>),
    );
    const existingCodes = new Set(mappedApplications.map((application) => application.code));
    const seededApplications = this.seedStore.listApplications(scopeKey)
      .filter((application) => !storeId || application.store_id === storeId)
      .filter((application) => application.is_delete !== true)
      .map((application) => mapApplicationRpcItem(application))
      .filter((application) => !existingCodes.has(application.code));

    return [...mappedApplications, ...seededApplications];
  }
}
