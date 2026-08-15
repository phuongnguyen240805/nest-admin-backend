import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomBytes, randomUUID } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'

import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service'
import { AutomationBroadcastRecipientEntity, BroadcastEntity, FlowEntity } from '../entities'
import { FlowExecutionService } from '../runtime/flow-execution.service'
import { AutomationOutboundDispatchService } from '../services/automation-outbound-dispatch.service'
import { AutomationBroadcastAudienceService } from './automation-broadcast-audience.service'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationBroadcastRuntimeService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BroadcastEntity)
    private readonly broadcasts: Repository<BroadcastEntity>,
    @InjectRepository(AutomationBroadcastRecipientEntity)
    private readonly recipients: Repository<AutomationBroadcastRecipientEntity>,
    @InjectRepository(FlowEntity)
    private readonly flows: Repository<FlowEntity>,
    private readonly executions: FlowExecutionService,
    private readonly outbound: AutomationOutboundDispatchService,
    private readonly audience: AutomationBroadcastAudienceService,
  ) {}

  async create(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const payload = this.record(body.broadcast ?? body.data ?? body)
    const ownerId = this.requiredString(ctx.ownerId ?? payload.owner_id, 'owner-id')
    const name = this.requiredString(payload.name, 'name')
    const flowId = this.optionalString(payload.flow_id ?? payload.flowId)
    if (flowId) await this.requireFlow(tenantId, flowId)
    const row = await this.broadcasts.save(this.broadcasts.create({
      tenantId,
      externalId: this.stringOr(payload._id, this.newExternalId()),
      storeId: this.requiredString(payload.store_id, 'store_id'),
      ownerId,
      creatorId: this.stringOr(payload.creator_id, ownerId),
      subOwnerId: this.optionalString(payload.sub_owner_id),
      flowId,
      name,
      alias: this.stringOr(payload.alias, this.slug(name)),
      type: this.stringOr(payload.type, 'CUSTOMER_CARE'),
      status: 'DRAFT',
      version: this.optionalString(payload.version),
      scopeType: this.stringOr(payload.scope_type, 'PRIVATE'),
      configType: this.optionalString(payload.config_type),
      isDelete: false,
      sentDate: null,
      startDate: this.optionalDate(payload.start_date),
      totalClick: 0,
      totalDelivery: 0,
      totalRead: 0,
      totalSend: 0,
      segments: this.array(payload.segments),
      tags: this.array(payload.tags),
      conditions: this.array(payload.conditions),
      scopeUsers: this.array(payload.scope_users),
      scopeTeams: this.array(payload.scope_teams),
      email: this.record(payload.email),
      messenger: this.record(payload.messenger),
      sms: this.record(payload.sms),
      zalo: this.record(payload.zalo),
      operator: payload.operator ?? null,
      sendLimitOption: payload.send_limit_option ?? null,
    }))
    return { broadcast: this.map(row) }
  }

  async update(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const payload = this.record(body.broadcast ?? body.data ?? body)
    const id = this.requiredString(payload._id ?? body.broadcast_id ?? body.id, 'broadcast_id')
    const row = await this.requireBroadcast(tenantId, id)
    if (row.status !== 'DRAFT') throw new BadRequestException('Only DRAFT broadcasts can be edited')
    if (payload.name != null) row.name = this.requiredString(payload.name, 'name')
    if (payload.alias != null) row.alias = this.requiredString(payload.alias, 'alias')
    if (payload.flow_id !== undefined || payload.flowId !== undefined) {
      const flowId = this.optionalString(payload.flow_id ?? payload.flowId)
      if (flowId) await this.requireFlow(tenantId, flowId)
      row.flowId = flowId
    }
    if (payload.type != null) row.type = this.requiredString(payload.type, 'type')
    if (payload.start_date !== undefined) row.startDate = this.optionalDate(payload.start_date)
    if (payload.segments != null) row.segments = this.array(payload.segments)
    if (payload.tags != null) row.tags = this.array(payload.tags)
    if (payload.conditions != null) row.conditions = this.array(payload.conditions)
    if (payload.zalo != null) row.zalo = this.record(payload.zalo)
    if (payload.messenger != null) row.messenger = this.record(payload.messenger)
    await this.broadcasts.save(row)
    return { broadcast: this.map(row) }
  }

  async dryRun(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const id = this.requiredString(body.broadcast_id ?? body._id ?? body.id, 'broadcast_id')
    const row = await this.requireBroadcast(tenantId, id)
    const items = await this.audience.resolve(row, { allowAll: body.allow_all === true })
    return {
      broadcast_id: id,
      audience_count: items.length,
      sample: items.slice(0, 20),
      dry_run: true,
    }
  }

  async schedule(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const id = this.requiredString(body.broadcast_id ?? body._id ?? body.id, 'broadcast_id')
    const row = await this.requireBroadcast(tenantId, id)
    if (!row.flowId) throw new BadRequestException('Broadcast requires flow_id')
    const flow = await this.requireFlow(tenantId, row.flowId)
    if (String(flow.status).toUpperCase() !== 'PUBLISHED') throw new BadRequestException('Broadcast flow must be published')
    if (row.status !== 'DRAFT') throw new BadRequestException('Only DRAFT broadcasts can be scheduled')

    const items = await this.audience.resolve(row, { allowAll: body.allow_all === true })
    if (!items.length) throw new BadRequestException('Broadcast audience is empty')
    for (const item of items) await this.ensureRecipient(row, item)

    row.startDate = this.optionalDate(body.start_date ?? body.startDate) ?? row.startDate ?? new Date()
    row.status = 'SCHEDULED'
    row.sentDate = null
    row.totalSend = 0
    await this.broadcasts.save(row)
    return { broadcast: this.map(row), audience_count: items.length }
  }

  async cancel(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const id = this.requiredString(body.broadcast_id ?? body._id ?? body.id, 'broadcast_id')
    const row = await this.requireBroadcast(tenantId, id)
    if (row.status === 'SENT') return { cancelled: false, broadcast: this.map(row) }
    row.status = 'CANCELLED'
    await this.broadcasts.save(row)
    const activeRecipients = await this.recipients.createQueryBuilder('recipient')
      .where('recipient.tenantId = :tenantId', { tenantId })
      .andWhere('recipient.broadcast_id = :broadcastId', { broadcastId: id })
      .andWhere('recipient.flow_execution_id IS NOT NULL')
      .andWhere("recipient.status IN ('RUNNING','QUEUED','PENDING')")
      .getMany()

    await this.recipients.createQueryBuilder()
      .update()
      .set({ status: 'CANCELLED', completedAt: new Date() })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('broadcast_id = :broadcastId', { broadcastId: id })
      .andWhere("status IN ('PENDING','QUEUED')")
      .execute()

    for (const recipient of activeRecipients) {
      if (!recipient.flowExecutionId) continue
      await this.executions.cancel(tenantId, recipient.flowExecutionId, 'broadcast-cancelled').catch(() => undefined)
      await this.outbound.cancelForExecution(tenantId, recipient.flowExecutionId, 'broadcast-cancelled').catch(() => undefined)
      recipient.status = 'CANCELLED'
      recipient.completedAt = new Date()
      recipient.lastError = null
      await this.recipients.save(recipient)
    }
    return { cancelled: true, broadcast: this.map(row) }
  }

  async dueBroadcasts(limit = 20): Promise<BroadcastEntity[]> {
    return this.broadcasts.createQueryBuilder('broadcast')
      .where("broadcast.status = 'SCHEDULED'")
      .andWhere('broadcast.is_delete = false')
      .andWhere('(broadcast.start_date IS NULL OR broadcast.start_date <= NOW())')
      .orderBy('broadcast.start_date', 'ASC', 'NULLS FIRST')
      .take(limit)
      .getMany()
  }

  async dispatchableBroadcasts(limit = 20): Promise<BroadcastEntity[]> {
    return this.broadcasts.createQueryBuilder('broadcast')
      .where("broadcast.status IN ('SCHEDULED','SENDING')")
      .andWhere('broadcast.is_delete = false')
      .andWhere('(broadcast.start_date IS NULL OR broadcast.start_date <= NOW())')
      .orderBy('broadcast.start_date', 'ASC', 'NULLS FIRST')
      .take(limit)
      .getMany()
  }

  async activate(tenantId: number, externalId: string): Promise<BroadcastEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BroadcastEntity)
      const row = await repo.createQueryBuilder('broadcast')
        .setLock('pessimistic_write')
        .where('broadcast.tenantId = :tenantId', { tenantId })
        .andWhere('broadcast._id = :externalId', { externalId })
        .getOne()
      if (!row || row.status !== 'SCHEDULED') return null
      row.status = 'SENDING'
      return repo.save(row)
    })
  }

  async pendingRecipients(tenantId: number, broadcastId: string, limit = 200) {
    return this.recipients.find({
      where: { tenantId, broadcastExternalId: broadcastId, status: 'PENDING' },
      order: { id: 'ASC' },
      take: limit,
    })
  }

  async markQueued(tenantId: number, recipientId: string) {
    await this.recipients.createQueryBuilder()
      .update()
      .set({ status: 'QUEUED' })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('recipient_id = :recipientId', { recipientId })
      .andWhere("status = 'PENDING'")
      .execute()
  }

  async claimRecipient(tenantId: number, recipientId: string): Promise<AutomationBroadcastRecipientEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AutomationBroadcastRecipientEntity)
      const row = await repo.createQueryBuilder('recipient')
        .setLock('pessimistic_write')
        .where('recipient.tenantId = :tenantId', { tenantId })
        .andWhere('recipient.recipient_id = :recipientId', { recipientId })
        .getOne()
      if (!row) return null
      if (row.status === 'RUNNING' && row.flowExecutionId) return row
      if (!['PENDING', 'QUEUED', 'RUNNING'].includes(row.status)) return null
      row.status = 'RUNNING'
      row.lastError = null
      return repo.save(row)
    })
  }

  async attachExecution(tenantId: number, recipientId: string, executionId: string) {
    await this.recipients.update({ tenantId, recipientId }, { flowExecutionId: executionId, status: 'RUNNING' })
  }

  async getBroadcastForRecipient(recipient: AutomationBroadcastRecipientEntity) {
    return this.broadcasts.findOne({ where: { tenantId: recipient.tenantId, externalId: recipient.broadcastExternalId, isDelete: false } })
  }

  async onFlowCompleted(tenantId: number, flowExecutionId: string) {
    const recipient = await this.recipients.findOne({ where: { tenantId, flowExecutionId } })
    if (!recipient || ['SENT', 'CANCELLED'].includes(recipient.status)) return
    recipient.status = 'SENT'
    recipient.completedAt = new Date()
    recipient.lastError = null
    await this.recipients.save(recipient)
    await this.maybeFinalize(tenantId, recipient.broadcastExternalId)
  }

  async onFlowFailed(tenantId: number, flowExecutionId: string, error: unknown) {
    const recipient = await this.recipients.findOne({ where: { tenantId, flowExecutionId } })
    if (!recipient || ['SENT', 'FAILED', 'CANCELLED'].includes(recipient.status)) return
    recipient.status = 'FAILED'
    recipient.completedAt = new Date()
    recipient.lastError = error instanceof Error ? error.message : String(error)
    await this.recipients.save(recipient)
    await this.maybeFinalize(tenantId, recipient.broadcastExternalId)
  }

  async failRecipient(tenantId: number, recipientId: string, error: unknown) {
    const recipient = await this.recipients.findOne({ where: { tenantId, recipientId } })
    if (!recipient) return
    recipient.status = 'FAILED'
    recipient.completedAt = new Date()
    recipient.lastError = error instanceof Error ? error.message : String(error)
    await this.recipients.save(recipient)
    await this.maybeFinalize(tenantId, recipient.broadcastExternalId)
  }

  async cancelRecipient(tenantId: number, recipientId: string) {
    const recipient = await this.recipients.findOne({ where: { tenantId, recipientId } })
    if (!recipient || ['SENT', 'FAILED', 'CANCELLED'].includes(recipient.status)) return
    recipient.status = 'CANCELLED'
    recipient.completedAt = new Date()
    recipient.lastError = null
    await this.recipients.save(recipient)
    await this.maybeFinalize(tenantId, recipient.broadcastExternalId)
  }

  async deferRecipient(tenantId: number, recipientId: string): Promise<void> {
    const recipient = await this.recipients.findOne({ where: { tenantId, recipientId } })
    if (!recipient || recipient.flowExecutionId || ['SENT', 'FAILED', 'CANCELLED'].includes(recipient.status)) return
    recipient.status = 'PENDING'
    recipient.lastError = null
    recipient.completedAt = null
    await this.recipients.save(recipient)
  }

  private async maybeFinalize(tenantId: number, broadcastId: string) {
    const [total, sent, failed, active] = await Promise.all([
      this.recipients.count({ where: { tenantId, broadcastExternalId: broadcastId } }),
      this.recipients.count({ where: { tenantId, broadcastExternalId: broadcastId, status: 'SENT' } }),
      this.recipients.count({ where: { tenantId, broadcastExternalId: broadcastId, status: 'FAILED' } }),
      this.recipients.createQueryBuilder('recipient')
        .where('recipient.tenantId = :tenantId', { tenantId })
        .andWhere('recipient.broadcast_id = :broadcastId', { broadcastId })
        .andWhere("recipient.status IN ('PENDING','QUEUED','RUNNING')")
        .getCount(),
    ])
    const row = await this.broadcasts.findOne({ where: { tenantId, externalId: broadcastId } })
    if (!row) return
    row.totalSend = sent
    if (active === 0 && total > 0 && row.status !== 'CANCELLED') {
      row.status = sent > 0 ? 'SENT' : failed > 0 ? 'FAILED' : row.status
      row.sentDate = new Date()
    }
    await this.broadcasts.save(row)
  }

  private async ensureRecipient(row: BroadcastEntity, item: { contactIdentityId: number | null; conversationId: string; channelAccountId: number; provider: string }) {
    const existing = await this.recipients.findOne({
      where: { tenantId: row.tenantId, broadcastExternalId: row.externalId, conversationId: item.conversationId },
    })
    if (existing) return existing
    try {
      return await this.recipients.save(this.recipients.create({
        tenantId: row.tenantId,
        recipientId: randomUUID(),
        broadcastExternalId: row.externalId,
        contactIdentityId: item.contactIdentityId,
        conversationId: item.conversationId,
        channelAccountId: item.channelAccountId,
        provider: item.provider,
        status: 'PENDING',
        flowExecutionId: null,
        lastError: null,
        completedAt: null,
      }))
    } catch (error) {
      const raced = await this.recipients.findOne({
        where: { tenantId: row.tenantId, broadcastExternalId: row.externalId, conversationId: item.conversationId },
      })
      if (raced) return raced
      throw error
    }
  }

  private async requireBroadcast(tenantId: number, externalId: string) {
    const row = await this.broadcasts.findOne({ where: { tenantId, externalId, isDelete: false } })
    if (!row) throw new NotFoundException('Broadcast not found')
    return row
  }

  private async requireFlow(tenantId: number, externalId: string) {
    const row = await this.flows.findOne({ where: { tenantId, externalId, isDelete: false } })
    if (!row) throw new BadRequestException('flow_id does not belong to this tenant')
    return row
  }

  private map(row: BroadcastEntity) {
    return {
      _id: row.externalId,
      store_id: row.storeId,
      owner_id: row.ownerId,
      creator_id: row.creatorId,
      flow_id: row.flowId,
      name: row.name,
      alias: row.alias,
      type: row.type,
      status: row.status,
      start_date: row.startDate,
      sent_date: row.sentDate,
      total_send: row.totalSend,
      total_delivery: row.totalDelivery,
      total_read: row.totalRead,
      total_click: row.totalClick,
      segments: row.segments,
      tags: row.tags,
      conditions: row.conditions,
      zalo: row.zalo,
      messenger: row.messenger,
    }
  }

  private requireTenant(ctx: LadiflowRpcContext): number {
    const tenantId = Number(ctx.tenantId)
    if (!Number.isInteger(tenantId) || tenantId <= 0) throw new BadRequestException('x-tenant-id is required for automation writes')
    return tenantId
  }

  private requiredString(value: unknown, name: string): string {
    const text = String(value ?? '').trim()
    if (!text) throw new BadRequestException(`${name} is required`)
    return text
  }

  private optionalString(value: unknown): string | null {
    const text = String(value ?? '').trim()
    return text || null
  }

  private stringOr(value: unknown, fallback: string): string {
    const text = String(value ?? '').trim()
    return text || fallback
  }

  private optionalDate(value: unknown): Date | null {
    if (!value) return null
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) throw new BadRequestException('start_date is invalid')
    return date
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }

  private newExternalId() {
    return randomBytes(12).toString('hex')
  }

  private slug(value: string) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || this.newExternalId()
  }
}
