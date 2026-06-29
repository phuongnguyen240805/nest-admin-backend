import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { loadContractFixtureData } from '../../common/utils/contract-fixture.util'
import type { RpcContext } from '../ladipage-rpc/rpc-dispatcher.service'
import { mapLandingDomainRpcItem } from '../ladipage-rpc/mappers/landing.mapper'
import { DomainEntity } from './entities'

type JsonRecord = Record<string, unknown>

@Injectable()
export class DomainService {
  constructor(
    @Optional()
    @InjectRepository(DomainEntity)
    private readonly domainRepository?: Repository<DomainEntity>,
  ) {}

  list(body: JsonRecord, ctx: RpcContext): JsonRecord {
    if (this.domainRepository) {
      return this.listFromRepository(body, ctx) as unknown as JsonRecord
    }

    return this.listFixture()
  }

  private async listFromRepository(body: JsonRecord, ctx: RpcContext): Promise<JsonRecord> {
    const template = this.listFixture()
    const limit = this.positiveNumber(body.limit, Number(template.limit ?? 100))
    const page = this.positiveNumber(body.page, 1)
    const query = this.domainRepository!.createQueryBuilder('domain')
      .where('domain.is_delete = false')

    if (ctx.tenantId != null) {
      query.andWhere('domain.tenantId = :tenantId', { tenantId: ctx.tenantId })
    }

    const [domains, total] = await query
      .orderBy('domain.isDefault', 'DESC')
      .addOrderBy('domain.domain', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    if (total === 0 && ctx.tenantId == null) return template

    return {
      ...template,
      total,
      limit,
      items: domains.map((domain) => mapLandingDomainRpcItem(domain as unknown as JsonRecord)),
    }
  }

  private listFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phase1', 'domain__list.json')
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
  }
}
