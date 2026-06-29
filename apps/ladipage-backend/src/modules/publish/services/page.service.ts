import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { loadContractFixtureData } from '../../../common/utils/contract-fixture.util'
import type { RpcContext } from '../../ladipage-rpc/rpc-dispatcher.service'
import { mapLandingPageRpcItem, mapLandingPageShowRpcItem } from '../../ladipage-rpc/mappers/landing.mapper'
import { PageEntity } from '../entities'

type JsonRecord = Record<string, unknown>

@Injectable()
export class PageService {
  constructor(
    @Optional()
    @InjectRepository(PageEntity)
    private readonly pageRepository?: Repository<PageEntity>,
  ) {}

  list(body: JsonRecord, ctx: RpcContext): JsonRecord {
    if (this.pageRepository) {
      return this.listFromRepository(body, ctx) as unknown as JsonRecord
    }

    return this.listFixture()
  }

  show(body: JsonRecord, ctx: RpcContext): JsonRecord {
    if (this.pageRepository) {
      return this.showFromRepository(body, ctx) as unknown as JsonRecord
    }

    return this.showFixture()
  }

  private async listFromRepository(body: JsonRecord, ctx: RpcContext): Promise<JsonRecord> {
    const template = this.listFixture()
    const limit = this.positiveNumber(body.limit, Number(template.limit ?? 100))
    const page = this.positiveNumber(body.page, 1)
    const query = this.pageRepository!.createQueryBuilder('page')
      .where('page.is_delete = false')

    if (ctx.tenantId != null) {
      query.andWhere('page.tenantId = :tenantId', { tenantId: ctx.tenantId })
    }

    if (ctx.storeId) {
      query.andWhere('page.store_id = :storeId', { storeId: ctx.storeId })
    }

    const [pages, total] = await query
      .orderBy('page.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    if (total === 0 && ctx.tenantId == null) return template

    return {
      ...template,
      total,
      limit,
      is_empty: total === 0,
      items: pages.map((item) => mapLandingPageRpcItem(item as unknown as JsonRecord)),
    }
  }

  private async showFromRepository(body: JsonRecord, ctx: RpcContext): Promise<JsonRecord> {
    const pageId = String(body.id ?? body.page_id ?? body._id ?? '')
    const query = this.pageRepository!.createQueryBuilder('page')
      .where('page.is_delete = false')

    if (ctx.tenantId != null) {
      query.andWhere('page.tenantId = :tenantId', { tenantId: ctx.tenantId })
    }

    if (ctx.storeId) {
      query.andWhere('page.store_id = :storeId', { storeId: ctx.storeId })
    }

    if (pageId) {
      query.andWhere('page._id = :pageId', { pageId })
    }

    const page = await query.getOne()
    if (!page) {
      return ctx.tenantId == null ? this.showFixture() : { source: '{}', ladipage: null }
    }

    return mapLandingPageShowRpcItem(page as unknown as JsonRecord)
  }

  private listFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phase1', 'ladi-page__list.json')
  }

  private showFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phase1', 'ladi-page__show.json')
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
  }
}
