import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { loadContractFixtureData } from '../../../common/utils/contract-fixture.util'
import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service'
import { mapAutomationBroadcastRpcItem } from '../../ladiflow-rpc/mappers/automation/broadcast.mapper'
import { mapAutomationFlowRpcItem, mapAutomationFlowShowRpcItem } from '../../ladiflow-rpc/mappers/automation/flow.mapper'
import { mapAutomationFlowTagRpcItem } from '../../ladiflow-rpc/mappers/automation/flow-tag.mapper'
import { mapAutomationIntegrationRpcItem } from '../../ladiflow-rpc/mappers/automation/integration.mapper'
import { BroadcastEntity, FlowEntity, FlowTagEntity, IntegrationEntity } from '../entities'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationService {
  constructor(
    @Optional()
    @InjectRepository(FlowEntity)
    private readonly flowRepository?: Repository<FlowEntity>,
    @Optional()
    @InjectRepository(BroadcastEntity)
    private readonly broadcastRepository?: Repository<BroadcastEntity>,
    @Optional()
    @InjectRepository(IntegrationEntity)
    private readonly integrationRepository?: Repository<IntegrationEntity>,
    @Optional()
    @InjectRepository(FlowTagEntity)
    private readonly flowTagRepository?: Repository<FlowTagEntity>,
  ) {}

  listFlows(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    if (this.flowRepository) {
      return this.listFlowsFromRepository(body, ctx) as unknown as JsonRecord
    }

    return this.flowListFixture()
  }

  showFlow(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    if (this.flowRepository) {
      return this.showFlowFromRepository(body, ctx) as unknown as JsonRecord
    }

    return this.flowShowFixture()
  }

  listBroadcasts(body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    if (this.broadcastRepository) {
      return this.listBroadcastsFromRepository(body, ctx) as unknown as JsonRecord
    }

    return this.broadcastListFixture()
  }

  listIntegrations(_body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    if (this.integrationRepository) {
      return this.listIntegrationsFromRepository(ctx) as unknown as JsonRecord
    }

    return this.integrationListFixture()
  }

  listFlowTags(_body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    if (this.flowTagRepository) {
      return this.listFlowTagsFromRepository(ctx) as unknown as JsonRecord
    }

    return this.flowTagListFixture()
  }

  private async listFlowsFromRepository(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const limit = this.positiveNumber(body.limit, 100)
    const page = this.positiveNumber(body.page, 1)
    const query = this.flowRepository!.createQueryBuilder('flow')
      .where('flow.is_delete = false')

    this.scopeLadiflowQuery(query, 'flow', ctx)

    const [flows, total] = await query
      .orderBy('flow.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    if (total === 0 && ctx.tenantId == null) return this.flowListFixture()

    return {
      total,
      limit,
      is_empty: total === 0,
      items: flows.map((flow) => mapAutomationFlowRpcItem(flow as unknown as JsonRecord)),
    }
  }

  private async showFlowFromRepository(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const flowId = String(body.flow_id ?? body._id ?? body.id ?? '')
    const query = this.flowRepository!.createQueryBuilder('flow')
      .where('flow.is_delete = false')

    this.scopeLadiflowQuery(query, 'flow', ctx)

    if (flowId) {
      query.andWhere('flow._id = :flowId', { flowId })
    }

    const flow = await query.getOne()
    if (!flow) {
      return ctx.tenantId == null ? this.flowShowFixture() : { flow: null }
    }

    return mapAutomationFlowShowRpcItem(flow as unknown as JsonRecord)
  }

  private async listBroadcastsFromRepository(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const limit = this.positiveNumber(body.limit, 100)
    const page = this.positiveNumber(body.page, 1)
    const query = this.broadcastRepository!.createQueryBuilder('broadcast')
      .where('broadcast.is_delete = false')

    this.scopeLadiflowQuery(query, 'broadcast', ctx)

    const [broadcasts, total] = await query
      .orderBy('broadcast.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    if (total === 0 && ctx.tenantId == null) return this.broadcastListFixture()

    return {
      total,
      limit,
      is_empty: total === 0,
      items: broadcasts.map((broadcast) =>
        mapAutomationBroadcastRpcItem(broadcast as unknown as JsonRecord)),
    }
  }

  private async listIntegrationsFromRepository(ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const query = this.integrationRepository!.createQueryBuilder('integration')
      .where('integration.is_delete = false')

    this.scopeLadiflowQuery(query, 'integration', ctx)

    const integrations = await query.orderBy('integration.name', 'ASC').getMany()
    if (integrations.length === 0 && ctx.tenantId == null) return this.integrationListFixture()

    return {
      total: integrations.length,
      items: integrations.map((integration) =>
        mapAutomationIntegrationRpcItem(integration as unknown as JsonRecord)),
    }
  }

  private async listFlowTagsFromRepository(ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const query = this.flowTagRepository!.createQueryBuilder('tag')
      .where('tag.is_delete = false')

    this.scopeLadiflowQuery(query, 'tag', ctx)

    const tags = await query.orderBy('tag.name', 'ASC').getMany()
    if (tags.length === 0 && ctx.tenantId == null) return this.flowTagListFixture()

    return {
      items: tags.map((tag) => mapAutomationFlowTagRpcItem(tag as unknown as JsonRecord)),
    }
  }

  private scopeLadiflowQuery(
    query: { andWhere: (condition: string, parameters?: Record<string, unknown>) => unknown },
    alias: string,
    ctx: LadiflowRpcContext,
  ): void {
    if (ctx.tenantId != null) {
      query.andWhere(`${alias}.tenantId = :tenantId`, { tenantId: ctx.tenantId })
    }

    if (ctx.ownerId) {
      query.andWhere(`(${alias}.owner_id = :ownerId OR ${alias}.scope_type = :publicScope)`, {
        ownerId: ctx.ownerId,
        publicScope: 'PUBLIC',
      })
    }
  }

  private flowListFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phaseC', 'flow__list.json')
  }

  private flowShowFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phaseC', 'flow__show.json')
  }

  private broadcastListFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phaseC', 'broadcast__list.json')
  }

  private integrationListFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phaseC', 'integration__list-all.json')
  }

  private flowTagListFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phaseC', 'flow-tag__list-all.json')
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
  }
}
