import { BadRequestException, Injectable, NotImplementedException, Optional } from '@nestjs/common';
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

type JsonRecord = Record<string, unknown>;

@Injectable()
export class ApplicationLifecycleService {
  constructor(
    private readonly seedStore: ApplicationSeedStore,
    private readonly accessService: ApplicationAccessService,
    @Optional()
    @InjectRepository(ApplicationEntity)
    private readonly applicationRepository?: Repository<ApplicationEntity>,
  ) {}

  async update(body: JsonRecord, ctx: RpcContext): Promise<LpApplication> {
    if (this.applicationRepository) {
      return this.updateRepository(body, ctx);
    }

    const tenantId = resolveAppStoreTenantId(ctx);
    const ownerId = resolveAppStoreOwnerId(ctx);
    const code = String(body.code ?? '').trim();
    if (!code) throw new BadRequestException('Application code is required.');

    const storeId = ctx.storeId ?? this.seedStore.getStoreId();
    const scopeKey = buildAppStoreScopeKey(tenantId, ownerId, storeId);
    const current = this.seedStore.findApplicationByCode(code, scopeKey, storeId)
      ?? this.newApplicationFromTemplate(code, storeId, ownerId);
    const next = {
      ...current,
      store_id: storeId ?? current.store_id,
      owner_id: ownerId,
      ladi_uid: ownerId,
    };

    await this.accessService.assertCanUpdate(
      mapApplicationRpcItem(next),
      body,
      ctx,
    );
    this.patchBoolean(next, body, 'status_active');
    this.patchBoolean(next, body, 'status_pin');
    this.patchInstallCounter(next, current, body);
    this.patchActivationTimestamp(next);
    this.patchUpdatedTimestamp(next);

    const saved = mapApplicationRpcItem(this.seedStore.saveApplication(next, scopeKey));
    return (await this.accessService.enrichList([saved], ctx))[0];
  }

  private async updateRepository(body: JsonRecord, ctx: RpcContext): Promise<LpApplication> {
    const tenantId = resolveAppStoreTenantId(ctx);
    const ownerId = resolveAppStoreOwnerId(ctx);
    const code = String(body.code ?? '').trim();
    if (!code) throw new BadRequestException('Application code is required.');

    const storeId = ctx.storeId ?? this.seedStore.getStoreId();
    const query = this.applicationRepository!.createQueryBuilder('application')
      .where('application.code = :code', { code })
      .andWhere('application.tenantId = :tenantId', { tenantId })
      .andWhere('application.ownerId = :ownerId', { ownerId });

    if (storeId) {
      query.andWhere('application.store_id = :storeId', { storeId });
    }

    let current = await query.getOne();

    if (!current) {
      const template = this.newApplicationFromTemplate(code, storeId, ownerId);
      current = this.applicationRepository!.create(this.entityFromRpc(template, tenantId, ownerId));
    }

    await this.accessService.assertCanUpdate(
      mapApplicationRpcItem(current as unknown as Record<string, unknown>),
      body,
      ctx,
    );
    this.patchEntityInstallCounter(current, body);
    this.patchEntityBoolean(current, body, 'status_active', 'statusActive');
    this.patchEntityBoolean(current, body, 'status_pin', 'statusPin');
    this.patchEntityActivationTimestamp(current);

    const saved = await this.applicationRepository!.save(current);
    const mapped = mapApplicationRpcItem(saved as unknown as Record<string, unknown>);
    return (await this.accessService.enrichList([mapped], ctx))[0];
  }

  private async updateSeed(body: JsonRecord, ctx: RpcContext): Promise<LpApplication> {
    const tenantId = resolveAppStoreTenantId(ctx);
    const ownerId = resolveAppStoreOwnerId(ctx);
    const code = String(body.code ?? '').trim();
    const storeId = ctx.storeId ?? this.seedStore.getStoreId();
    const scopeKey = buildAppStoreScopeKey(tenantId, ownerId, storeId);
    const current = this.seedStore.findApplicationByCode(code, scopeKey, storeId)
      ?? this.newApplicationFromTemplate(code, storeId, ownerId);
    const next = {
      ...current,
      store_id: storeId ?? current.store_id,
      owner_id: ownerId,
      ladi_uid: ownerId,
    };

    await this.accessService.assertCanUpdate(
      mapApplicationRpcItem(next),
      body,
      ctx,
    );
    this.patchBoolean(next, body, 'status_active');
    this.patchBoolean(next, body, 'status_pin');
    this.patchInstallCounter(next, current, body);
    this.patchActivationTimestamp(next);
    this.patchUpdatedTimestamp(next);

    const saved = mapApplicationRpcItem(this.seedStore.saveApplication(next, scopeKey));
    return (await this.accessService.enrichList([saved], ctx))[0];
  }

  private newApplicationFromTemplate(code: string, storeId?: string, ownerId?: string): JsonRecord {
    const template = this.seedStore.getApplicationTemplate(code);
    if (!template) {
      throw new NotImplementedException(
        `TODO(PhaseA): no CDP application template captured for code "${code}".`,
      );
    }

    return {
      ...template,
      store_id: storeId ?? template.store_id ?? this.seedStore.getStoreId(),
      owner_id: ownerId ?? template.owner_id ?? 'system',
      ladi_uid: ownerId ?? template.ladi_uid ?? template.owner_id ?? 'system',
    };
  }

  private patchBoolean(target: JsonRecord, source: JsonRecord, field: 'status_active' | 'status_pin'): void {
    if (!(field in source)) return;
    if (typeof source[field] !== 'boolean') {
      throw new BadRequestException(`${field} must be a boolean when provided.`);
    }

    target[field] = source[field];
  }

  private patchEntityBoolean(
    target: ApplicationEntity,
    source: JsonRecord,
    sourceField: 'status_active' | 'status_pin',
    targetField: 'statusActive' | 'statusPin',
  ): void {
    if (!(sourceField in source)) return;
    if (typeof source[sourceField] !== 'boolean') {
      throw new BadRequestException(`${sourceField} must be a boolean when provided.`);
    }

    target[targetField] = source[sourceField];
  }

  private patchActivationTimestamp(target: JsonRecord): void {
    if (target.status_active !== true || target.status_actived_at) return;
    target.status_actived_at = this.seedStore.getUpdateTimestamp();
  }

  private patchUpdatedTimestamp(target: JsonRecord): void {
    const timestamp = this.seedStore.getUpdateTimestamp();
    if (timestamp) target.updated_at = timestamp;
  }

  private patchInstallCounter(
    target: JsonRecord,
    current: JsonRecord,
    source: JsonRecord,
  ): void {
    if (source.status_active !== true || current.status_actived_at) return;
    target.installs_count = Number(current.installs_count ?? 0) + 1;
  }

  private patchEntityInstallCounter(
    target: ApplicationEntity,
    source: JsonRecord,
  ): void {
    if (source.status_active !== true || target.statusActivedAt) return;
    target.installsCount = Number(target.installsCount ?? 0) + 1;
  }

  private patchEntityActivationTimestamp(target: ApplicationEntity): void {
    if (target.statusActive !== true || target.statusActivedAt) return;
    const timestamp = this.seedStore.getUpdateTimestamp();
    target.statusActivedAt = timestamp ? new Date(timestamp) : new Date();
  }

  private entityFromRpc(
    value: JsonRecord,
    tenantId: number,
    ownerId: string,
  ): Partial<ApplicationEntity> {
    return {
      tenantId,
      externalId: String(value._id ?? `${value.store_id ?? 'store'}:${ownerId}:${value.code}`),
      storeId: String(value.store_id ?? ''),
      ownerId,
      ladiUid: ownerId,
      name: String(value.name ?? value.code ?? ''),
      code: String(value.code ?? ''),
      logo: value.logo == null ? null : String(value.logo),
      thumb: value.thumb == null ? null : String(value.thumb),
      price: Number(value.price ?? 0),
      statusActive: value.status_active === true,
      statusActivedAt: value.status_actived_at ? new Date(String(value.status_actived_at)) : null,
      statusPin: value.status_pin === true,
      isDelete: value.is_delete === true,
      viewsCount: Number(value.views_count ?? 0),
      installsCount: Number(value.installs_count ?? 0),
    };
  }
}
