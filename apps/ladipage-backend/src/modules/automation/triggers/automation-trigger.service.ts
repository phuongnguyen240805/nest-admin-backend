import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomBytes } from 'node:crypto'
import { Repository } from 'typeorm'

import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service'
import { AutomationTriggerEntity, FlowEntity } from '../entities'
import { KeywordMatcherService, type KeywordMatchMode } from './keyword-matcher.service'

const MESSAGE_INBOUND = 'customer-care.message.inbound'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationTriggerService {
  constructor(
    @InjectRepository(AutomationTriggerEntity)
    private readonly triggers: Repository<AutomationTriggerEntity>,
    @InjectRepository(FlowEntity)
    private readonly flows: Repository<FlowEntity>,
    private readonly keywordMatcher: KeywordMatcherService,
  ) {}

  async list(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const limit = this.positiveNumber(body.limit, 100)
    const page = this.positiveNumber(body.page, 1)
    const [items, total] = await this.triggers.findAndCount({
      where: { tenantId, isDelete: false },
      order: { priority: 'DESC', updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    return { total, limit, is_empty: total === 0, items: items.map((item) => this.map(item)) }
  }

  async create(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const payload = this.payload(body)
    const flowExternalId = this.requiredString(payload.flow_id ?? payload.flowId, 'flow_id')
    await this.requireFlow(tenantId, flowExternalId)
    const eventType = String(payload.event_type ?? payload.eventType ?? MESSAGE_INBOUND).trim()
    if (!eventType) throw new BadRequestException('event_type is required')

    const row = await this.triggers.save(this.triggers.create({
      tenantId,
      externalId: this.stringOr(payload._id, this.newExternalId()),
      name: this.stringOr(payload.name, 'Automation trigger'),
      flowExternalId,
      eventType,
      enabled: payload.enabled === true,
      priority: this.integer(payload.priority, 0),
      conditions: this.record(payload.conditions),
      config: this.record(payload.config),
      isDelete: false,
    }))
    return { trigger: this.map(row) }
  }

  async update(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const payload = this.payload(body)
    const externalId = this.requiredString(payload._id ?? payload.id ?? body.trigger_id, 'trigger_id')
    const row = await this.triggers.findOne({ where: { tenantId, externalId, isDelete: false } })
    if (!row) throw new NotFoundException('Automation trigger not found')

    if (payload.flow_id != null || payload.flowId != null) {
      const flowExternalId = this.requiredString(payload.flow_id ?? payload.flowId, 'flow_id')
      await this.requireFlow(tenantId, flowExternalId)
      row.flowExternalId = flowExternalId
    }
    if (payload.name != null) row.name = String(payload.name).trim() || row.name
    if (payload.event_type != null || payload.eventType != null) {
      row.eventType = this.requiredString(payload.event_type ?? payload.eventType, 'event_type')
    }
    if (typeof payload.enabled === 'boolean') row.enabled = payload.enabled
    if (payload.priority != null) row.priority = this.integer(payload.priority, row.priority)
    if (payload.conditions != null) row.conditions = this.record(payload.conditions)
    if (payload.config != null) row.config = this.record(payload.config)

    await this.triggers.save(row)
    return { trigger: this.map(row) }
  }

  async remove(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const externalId = this.requiredString(body.trigger_id ?? body._id ?? body.id, 'trigger_id')
    const row = await this.triggers.findOne({ where: { tenantId, externalId, isDelete: false } })
    if (!row) throw new NotFoundException('Automation trigger not found')
    row.isDelete = true
    row.enabled = false
    await this.triggers.save(row)
    return { deleted: true, trigger_id: externalId }
  }

  async matchInboundEvent(input: {
    tenantId: number
    eventType: string
    payload: Record<string, unknown>
  }): Promise<AutomationTriggerEntity[]> {
    const message = this.record(input.payload.message)
    const direction = String(message.direction ?? input.payload.direction ?? '').toLowerCase()
    const isSelf = message.isSelf === true || message.is_self === true || input.payload.isSelf === true || input.payload.is_self === true
    const selfEvent = direction === 'outgoing' || isSelf
    if (input.eventType === MESSAGE_INBOUND && selfEvent && process.env.AUTOMATION_TRIGGER_ALLOW_SELF_MESSAGES !== 'true') return []

    let rows = await this.triggers.find({
      where: {
        tenantId: input.tenantId,
        eventType: input.eventType,
        enabled: true,
        isDelete: false,
      },
      order: { priority: 'DESC', id: 'ASC' },
    })

    if (input.eventType !== MESSAGE_INBOUND) return rows
    if (selfEvent) {
      rows = rows.filter((trigger) => trigger.config?.allowSelfMessages === true || trigger.config?.allow_self_messages === true)
    }
    const text = String(message.content ?? message.text ?? input.payload.text ?? '')
    return rows.filter((trigger) => this.matchesMessageTrigger(text, trigger))
  }

  private matchesMessageTrigger(text: string, trigger: AutomationTriggerEntity): boolean {
    const config = trigger.config ?? {}
    const keywords = Array.isArray(config.keywords)
      ? config.keywords.map((value) => String(value)).filter(Boolean)
      : []
    if (keywords.length === 0) return true

    const rawMode = String(config.mode ?? 'CONTAINS').toUpperCase()
    const mode: KeywordMatchMode = ['EXACT', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH'].includes(rawMode)
      ? rawMode as KeywordMatchMode
      : 'CONTAINS'

    return this.keywordMatcher.matches(text, {
      keywords,
      mode,
      matchAll: config.matchAll === true || config.match_all === true,
      caseSensitive: config.caseSensitive === true || config.case_sensitive === true,
    })
  }

  private async requireFlow(tenantId: number, externalId: string) {
    const flow = await this.flows.findOne({ where: { tenantId, externalId, isDelete: false } })
    if (!flow) throw new BadRequestException('flow_id does not belong to this tenant')
    return flow
  }

  private map(row: AutomationTriggerEntity) {
    return {
      _id: row.externalId,
      name: row.name,
      flow_id: row.flowExternalId,
      event_type: row.eventType,
      enabled: row.enabled,
      priority: row.priority,
      conditions: row.conditions,
      config: row.config,
      is_delete: row.isDelete,
      created_at: row.createdAt?.toISOString?.() ?? row.createdAt,
      updated_at: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    }
  }

  private requireTenant(ctx: LadiflowRpcContext): number {
    const tenantId = Number(ctx.tenantId)
    if (!Number.isInteger(tenantId) || tenantId <= 0) throw new BadRequestException('x-tenant-id is required for automation writes')
    return tenantId
  }

  private payload(body: JsonRecord): JsonRecord {
    return this.record(body.trigger ?? body.data ?? body)
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
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

  private integer(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
  }

  private newExternalId(): string {
    return randomBytes(12).toString('hex')
  }
}
