import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { LpApplication } from '@liora/ladipage-types';

import type { RpcContext } from '../../ladipage-rpc/rpc-dispatcher.service';
import { mapApplicationRpcItem } from '../../ladipage-rpc/mappers/landing/application.mapper';
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
    if (this.applicationRepository) {
      return this.accessService.enrichList(await this.listFromRepository(ctx), ctx);
    }

    const storeId = ctx.storeId ?? this.seedStore.getStoreId();

    const applications = this.seedStore.listApplications()
      .filter((application) => !storeId || application.store_id === storeId)
      .filter((application) => application.is_delete !== true)
      .map((application) => mapApplicationRpcItem(application));

    return this.accessService.enrichList(applications, ctx);
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

    const mappedApplications = applications.map((application) =>
      mapApplicationRpcItem(application as unknown as Record<string, unknown>),
    );
    const existingCodes = new Set(mappedApplications.map((application) => application.code));
    const seededApplications = this.seedStore.listApplications()
      .filter((application) => !storeId || application.store_id === storeId)
      .filter((application) => application.is_delete !== true)
      .map((application) => mapApplicationRpcItem(application))
      .filter((application) => !existingCodes.has(application.code));

    return [...mappedApplications, ...seededApplications];
  }
}
