import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomBytes } from 'node:crypto'
import { Repository } from 'typeorm'

import { loadContractFixtureData } from '../../../common/utils/contract-fixture.util'
import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service'
import { mapAutomationBroadcastRpcItem } from '../../ladiflow-rpc/mappers/automation/broadcast.mapper'
import { mapAutomationFlowRpcItem, mapAutomationFlowShowRpcItem } from '../../ladiflow-rpc/mappers/automation/flow.mapper'
import { mapAutomationFlowTagRpcItem } from '../../ladiflow-rpc/mappers/automation/flow-tag.mapper'
import { mapAutomationIntegrationRpcItem } from '../../ladiflow-rpc/mappers/automation/integration.mapper'
import { BroadcastEntity, FlowEntity, FlowTagEntity, IntegrationEntity } from '../entities'
import { LadiflowGraphValidatorService } from '../graph/ladiflow-graph-validator.service'

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
    private readonly graphValidator?: LadiflowGraphValidatorService,
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


  async createFlow(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const repository = this.requireFlowRepository()
    const tenantId = this.requireTenant(ctx)
    const payload = this.payload(body)
    const ownerId = this.requiredString(ctx.ownerId ?? payload.owner_id, 'owner-id')
    const name = this.requiredString(payload.name, 'name')
    const graph = this.graphFromPayload(payload)
    const requestedStatus = String(payload.status ?? 'DRAFT').toUpperCase()
    if (requestedStatus === 'PUBLISHED') this.requireValidGraph(graph)

    const row = await repository.save(repository.create({
      tenantId,
      externalId: this.stringOr(payload._id, this.newExternalId()),
      storeId: this.requiredString(payload.store_id, 'store_id'),
      ownerId,
      creatorId: this.stringOr(payload.creator_id, ownerId),
      subOwnerId: this.nullableString(payload.sub_owner_id),
      name,
      alias: this.stringOr(payload.alias, this.slug(name)),
      status: requestedStatus,
      type: this.nullableString(payload.type),
      scopeType: this.stringOr(payload.scope_type, 'PRIVATE'),
      isDelete: false,
      isSharing: payload.is_sharing === true,
      totalSubscribe: this.integer(payload.total_subscribe, 0),
      flowConfigCount: this.flowConfigCount(graph),
      updatedLast: new Date(),
      tags: this.array(payload.tags),
      triggerTypes: this.array(payload.trigger_types),
      integrationIds: this.array(payload.integration_ids),
      scopeUsers: this.array(payload.scope_users),
      scopeTeams: this.array(payload.scope_teams),
      graph,
    }))

    return mapAutomationFlowShowRpcItem(row as unknown as JsonRecord)
  }

  async updateFlow(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const payload = this.payload(body)
    const flowId = this.requiredString(payload._id ?? body.flow_id ?? body.id, 'flow_id')
    const row = await this.findWritableFlow(flowId, ctx)

    if (payload.name != null) row.name = this.requiredString(payload.name, 'name')
    if (payload.alias != null) row.alias = this.requiredString(payload.alias, 'alias')
    if (payload.store_id != null) row.storeId = this.requiredString(payload.store_id, 'store_id')
    if (payload.sub_owner_id !== undefined) row.subOwnerId = this.nullableString(payload.sub_owner_id)
    if (payload.type !== undefined) row.type = this.nullableString(payload.type)
    if (payload.scope_type != null) row.scopeType = this.requiredString(payload.scope_type, 'scope_type')
    if (typeof payload.is_sharing === 'boolean') row.isSharing = payload.is_sharing
    if (payload.tags != null) row.tags = this.array(payload.tags)
    if (payload.trigger_types != null) row.triggerTypes = this.array(payload.trigger_types)
    if (payload.integration_ids != null) row.integrationIds = this.array(payload.integration_ids)
    if (payload.scope_users != null) row.scopeUsers = this.array(payload.scope_users)
    if (payload.scope_teams != null) row.scopeTeams = this.array(payload.scope_teams)

    if (this.containsGraphFields(payload)) {
      const graph = this.graphFromPayload(payload, row.graph ?? {})
      if (row.status === 'PUBLISHED') this.requireValidGraph(graph)
      row.graph = graph
      row.flowConfigCount = this.flowConfigCount(graph)
    }

    if (payload.status != null) {
      const status = String(payload.status).toUpperCase()
      if (status === 'PUBLISHED') this.requireValidGraph(row.graph)
      row.status = status
    }
    row.updatedLast = new Date()
    await this.requireFlowRepository().save(row)
    return mapAutomationFlowShowRpcItem(row as unknown as JsonRecord)
  }

  async validateFlow(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const payload = this.payload(body)
    let graph: Record<string, unknown> | null = null
    const flowId = String(payload._id ?? body.flow_id ?? body.id ?? '').trim()
    if (flowId) graph = (await this.findWritableFlow(flowId, ctx)).graph
    else {
      this.requireTenant(ctx)
      graph = this.graphFromPayload(payload)
    }
    return this.validateGraph(graph)
  }

  async publishFlow(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const flowId = this.requiredString(body.flow_id ?? body._id ?? body.id, 'flow_id')
    const row = await this.findWritableFlow(flowId, ctx)
    this.requireValidGraph(row.graph)
    row.status = 'PUBLISHED'
    row.updatedLast = new Date()
    await this.requireFlowRepository().save(row)
    return mapAutomationFlowShowRpcItem(row as unknown as JsonRecord)
  }

  async unpublishFlow(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const flowId = this.requiredString(body.flow_id ?? body._id ?? body.id, 'flow_id')
    const row = await this.findWritableFlow(flowId, ctx)
    row.status = 'DRAFT'
    row.updatedLast = new Date()
    await this.requireFlowRepository().save(row)
    return mapAutomationFlowShowRpcItem(row as unknown as JsonRecord)
  }

  async duplicateFlow(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const flowId = this.requiredString(body.flow_id ?? body._id ?? body.id, 'flow_id')
    const source = await this.findWritableFlow(flowId, ctx)
    const repository = this.requireFlowRepository()
    const name = this.stringOr(body.name, `${source.name} copy`)
    const row = await repository.save(repository.create({
      tenantId: source.tenantId,
      externalId: this.newExternalId(),
      storeId: source.storeId,
      ownerId: source.ownerId,
      creatorId: source.creatorId,
      subOwnerId: source.subOwnerId,
      name,
      alias: this.stringOr(body.alias, `${source.alias}-copy-${Date.now()}`),
      status: 'DRAFT',
      type: source.type,
      scopeType: source.scopeType,
      isDelete: false,
      isSharing: false,
      totalSubscribe: 0,
      flowConfigCount: source.flowConfigCount,
      updatedLast: new Date(),
      tags: this.clone(source.tags),
      triggerTypes: this.clone(source.triggerTypes),
      integrationIds: this.clone(source.integrationIds),
      scopeUsers: this.clone(source.scopeUsers),
      scopeTeams: this.clone(source.scopeTeams),
      graph: source.graph ? this.clone(source.graph) : null,
    }))
    return mapAutomationFlowShowRpcItem(row as unknown as JsonRecord)
  }

  async deleteFlow(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const flowId = this.requiredString(body.flow_id ?? body._id ?? body.id, 'flow_id')
    const row = await this.findWritableFlow(flowId, ctx)
    row.isDelete = true
    row.status = 'ARCHIVED'
    row.updatedLast = new Date()
    await this.requireFlowRepository().save(row)
    return { deleted: true, flow_id: flowId }
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


  private async findWritableFlow(externalId: string, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const row = await this.requireFlowRepository().findOne({
      where: { tenantId, externalId, isDelete: false },
    })
    if (!row || (ctx.ownerId && row.ownerId !== ctx.ownerId)) {
      throw new NotFoundException('Flow not found')
    }
    return row
  }

  private validateGraph(graph: unknown) {
    if (!this.graphValidator) {
      return {
        valid: false,
        schema: 'unknown',
        errors: ['Graph validator is not available.'],
        warnings: [],
      }
    }
    return this.graphValidator.validate(graph)
  }

  private requireValidGraph(graph: unknown) {
    const result = this.validateGraph(graph)
    if (!result.valid) {
      throw new BadRequestException({ message: 'Flow graph is invalid', ...result })
    }
    return result
  }

  private graphFromPayload(
    payload: JsonRecord,
    current: Record<string, unknown> = {},
  ): Record<string, unknown> {
    if (payload.graph && typeof payload.graph === 'object' && !Array.isArray(payload.graph)) {
      return this.clone(payload.graph as JsonRecord)
    }
    const graph = this.clone(current)
    const graphKeys = [
      'triggers',
      'broadcast',
      'listVoucherCampaigns',
      'listCustomField',
      'customerTagList',
      'listSequence',
      'listIntegrations',
      'listRecurringTopics',
      'flowConfigs',
      'builder_direction',
      'report_builder_direction',
      'nodes',
      'edges',
    ]
    for (const key of graphKeys) {
      if (key in payload) graph[key] = this.clone(payload[key])
    }
    return graph
  }

  private containsGraphFields(payload: JsonRecord): boolean {
    return [
      'graph',
      'triggers',
      'flowConfigs',
      'nodes',
      'edges',
      'listSequence',
      'listIntegrations',
    ].some((key) => key in payload)
  }

  private flowConfigCount(graph: Record<string, unknown> | null): number {
    return graph && Array.isArray(graph.flowConfigs) ? graph.flowConfigs.length : 0
  }

  private requireFlowRepository(): Repository<FlowEntity> {
    if (!this.flowRepository) {
      throw new BadRequestException('Flow repository is not available')
    }
    return this.flowRepository
  }

  private requireTenant(ctx: LadiflowRpcContext): number {
    const tenantId = Number(ctx.tenantId)
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new BadRequestException('x-tenant-id is required for automation writes')
    }
    return tenantId
  }

  private payload(body: JsonRecord): JsonRecord {
    const value = body.flow ?? body.data ?? body
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as JsonRecord
      : {}
  }

  private requiredString(value: unknown, name: string): string {
    const text = String(value ?? '').trim()
    if (!text) throw new BadRequestException(`${name} is required`)
    return text
  }

  private stringOr(value: unknown, fallback: string): string {
    const text = String(value ?? '').trim()
    return text || fallback
  }

  private nullableString(value: unknown): string | null {
    const text = String(value ?? '').trim()
    return text || null
  }

  private integer(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? this.clone(value) : []
  }

  private clone<T>(value: T): T {
    return value == null ? value : JSON.parse(JSON.stringify(value)) as T
  }

  private slug(value: string): string {
    return value
      .toLocaleLowerCase('vi')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || this.newExternalId()
  }

  private newExternalId(): string {
    return randomBytes(12).toString('hex')
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
