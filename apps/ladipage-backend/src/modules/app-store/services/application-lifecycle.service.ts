import { BadRequestException, Injectable, NotImplementedException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { LpApplication } from '@liora/ladipage-types';

import type { RpcContext } from '../../ladipage-rpc/rpc-dispatcher.service';
import { mapApplicationRpcItem } from '../../ladipage-rpc/mappers/landing/application.mapper';
import { ApplicationSeedStore } from '../data/application-seed.store';
import { ApplicationEntity } from '../entities';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class ApplicationLifecycleService {
  constructor(
    private readonly seedStore: ApplicationSeedStore,
    @Optional()
    @InjectRepository(ApplicationEntity)
    private readonly applicationRepository?: Repository<ApplicationEntity>,
  ) {}

  update(body: JsonRecord, ctx: RpcContext): LpApplication {
    if (this.applicationRepository) {
      return this.updateRepository(body, ctx) as unknown as LpApplication;
    }

    const code = String(body.code ?? '').trim();
    if (!code) throw new BadRequestException('Application code is required.');

    const storeId = ctx.storeId ?? this.seedStore.getStoreId();
    const current = this.seedStore.findApplicationByCode(code, storeId)
      ?? this.newApplicationFromTemplate(code, storeId);
    const next = {
      ...current,
      store_id: storeId ?? current.store_id,
    };

    this.patchBoolean(next, body, 'status_active');
    this.patchBoolean(next, body, 'status_pin');
    this.patchActivationTimestamp(next);
    this.patchUpdatedTimestamp(next);

    return mapApplicationRpcItem(this.seedStore.saveApplication(next));
  }

  private async updateRepository(body: JsonRecord, ctx: RpcContext): Promise<LpApplication> {
    const code = String(body.code ?? '').trim();
    if (!code) throw new BadRequestException('Application code is required.');

    const storeId = ctx.storeId ?? this.seedStore.getStoreId();
    const query = this.applicationRepository!.createQueryBuilder('application')
      .where('application.code = :code', { code });

    if (ctx.tenantId != null) {
      query.andWhere('application.tenantId = :tenantId', { tenantId: ctx.tenantId });
    }

    if (storeId) {
      query.andWhere('application.store_id = :storeId', { storeId });
    }

    let current = await query.getOne();

    if (!current) {
      if (ctx.tenantId == null) {
        return this.updateSeed(body, ctx);
      }

      const template = this.newApplicationFromTemplate(code, storeId);
      current = this.applicationRepository!.create(this.entityFromRpc(template, ctx.tenantId));
    }

    this.patchEntityBoolean(current, body, 'status_active', 'statusActive');
    this.patchEntityBoolean(current, body, 'status_pin', 'statusPin');
    this.patchEntityActivationTimestamp(current);

    const saved = await this.applicationRepository!.save(current);
    return mapApplicationRpcItem(saved as unknown as Record<string, unknown>);
  }

  private updateSeed(body: JsonRecord, ctx: RpcContext): LpApplication {
    const code = String(body.code ?? '').trim();
    const storeId = ctx.storeId ?? this.seedStore.getStoreId();
    const current = this.seedStore.findApplicationByCode(code, storeId)
      ?? this.newApplicationFromTemplate(code, storeId);
    const next = {
      ...current,
      store_id: storeId ?? current.store_id,
    };

    this.patchBoolean(next, body, 'status_active');
    this.patchBoolean(next, body, 'status_pin');
    this.patchActivationTimestamp(next);
    this.patchUpdatedTimestamp(next);

    return mapApplicationRpcItem(this.seedStore.saveApplication(next));
  }

  private newApplicationFromTemplate(code: string, storeId?: string): JsonRecord {
    const template = this.seedStore.getApplicationTemplate(code);
    if (!template) {
      throw new NotImplementedException(
        `TODO(PhaseA): no CDP application template captured for code "${code}".`,
      );
    }

    return {
      ...template,
      store_id: storeId ?? template.store_id ?? this.seedStore.getStoreId(),
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

  private patchEntityActivationTimestamp(target: ApplicationEntity): void {
    if (target.statusActive !== true || target.statusActivedAt) return;
    const timestamp = this.seedStore.getUpdateTimestamp();
    target.statusActivedAt = timestamp ? new Date(timestamp) : new Date();
  }

  private entityFromRpc(value: JsonRecord, tenantId: number): Partial<ApplicationEntity> {
    return {
      tenantId,
      externalId: String(value._id ?? `${value.store_id ?? 'store'}:${value.code}`),
      storeId: String(value.store_id ?? ''),
      ownerId: String(value.owner_id ?? ''),
      ladiUid: String(value.ladi_uid ?? value.owner_id ?? ''),
      name: String(value.name ?? value.code ?? ''),
      code: String(value.code ?? ''),
      logo: value.logo == null ? null : String(value.logo),
      thumb: value.thumb == null ? null : String(value.thumb),
      price: Number(value.price ?? 0),
      statusActive: value.status_active === true,
      statusActivedAt: value.status_actived_at ? new Date(String(value.status_actived_at)) : null,
      statusPin: value.status_pin === true,
      isDelete: value.is_delete === true,
    };
  }
}
