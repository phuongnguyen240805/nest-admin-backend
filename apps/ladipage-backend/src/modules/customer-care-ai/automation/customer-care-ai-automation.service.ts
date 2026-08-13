import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { ContextIdFactory, ModuleRef } from '@nestjs/core'
import { InjectRepository } from '@nestjs/typeorm'
import { ClsService } from 'nestjs-cls'
import { DataSource, Repository } from 'typeorm'

import { CustomerCareService } from '../../customer-care/customer-care.service'
import { DomainOutboxEventEntity } from '../../domain-events/entities/domain-outbox-event.entity'
import { CustomerCareAiConfigService } from '../config/customer-care-ai-config.service'
import { CustomerCareAiOrchestratorService } from '../orchestration/customer-care-ai-orchestrator.service'
import { CustomerCareAiMetricsService } from '../observability/customer-care-ai-metrics.service'
import { customerCareAiRetryDelayMs, customerCareAutoReplySafety, normalizeCustomerCareIntent } from './customer-care-ai-automation.policy'

const INBOUND_EVENT = 'customer-care.message.inbound'
const OUTBOUND_EVENT = 'customer-care.message.outbound'

@Injectable()
export class CustomerCareAiAutomationService {
  private readonly logger = new Logger(CustomerCareAiAutomationService.name)
  private running = false

  constructor(
    private readonly dataSource: DataSource,
    private readonly moduleRef: ModuleRef,
    private readonly cls: ClsService,
    private readonly metrics: CustomerCareAiMetricsService,
    @InjectRepository(DomainOutboxEventEntity)
    private readonly events: Repository<DomainOutboxEventEntity>,
  ) {}

  @Interval(5_000)
  async poll() {
    if (this.running) return
    this.running = true
    try {
      const batchSize = this.intEnv('CUSTOMER_CARE_AI_AUTOMATION_BATCH_SIZE', 5, 1, 20)
      for (let index = 0; index < batchSize; index += 1) {
        const event = await this.claimOne()
        if (!event) break
        await this.process(event)
      }
    } finally {
      this.running = false
    }
  }

  private async claimOne(): Promise<DomainOutboxEventEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const leaseMs = this.intEnv('CUSTOMER_CARE_AI_AUTOMATION_LEASE_MS', 5 * 60_000, 30_000, 30 * 60_000)
      const rows = await manager.query(
        `SELECT "id" FROM "domain_outbox_event"
         WHERE "event_type" = $1
           AND "status" IN ('pending', 'processing')
           AND "available_at" <= NOW()
         ORDER BY "id" ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [INBOUND_EVENT],
      )
      const id = Number(rows?.[0]?.id)
      if (!Number.isInteger(id) || id <= 0) return null
      const repo = manager.getRepository(DomainOutboxEventEntity)
      const event = await repo.findOne({ where: { id } })
      if (!event) return null
      event.status = 'processing'
      event.attempts += 1
      // available_at doubles as a lease deadline while processing. If the
      // process dies, another worker can safely reclaim the event afterwards.
      event.availableAt = new Date(Date.now() + leaseMs)
      event.lastError = null
      return repo.save(event)
    })
  }

  private async process(event: DomainOutboxEventEntity) {
    try {
      if (process.env.CUSTOMER_CARE_AI_AUTOMATION_ENABLED !== 'true') {
        await this.finish(event, 'ignored', 'global-kill-switch')
        this.metrics.recordAutomation('skipped')
        return
      }

      if (await this.hasNewerInbound(event)) {
        await this.finish(event, 'superseded', 'newer-customer-message')
        this.metrics.recordAutomation('superseded')
        return
      }
      if (await this.hasAgentReplyAfter(event)) {
        await this.finish(event, 'ignored', 'agent-already-replied')
        this.metrics.recordAutomation('skipped')
        return
      }

      const config = await this.runInTenant(event.tenantId, async () => {
        const contextId = ContextIdFactory.create()
        const configService = await this.moduleRef.resolve(CustomerCareAiConfigService, contextId, { strict: false })
        return configService.getOrCreate()
      })
      if (!config?.enabled || config.mode !== 'autopilot' || !config.autoReplyEnabled) {
        await this.finish(event, 'ignored', 'tenant-auto-reply-disabled')
        this.metrics.recordAutomation('skipped')
        return
      }

      const result = await this.runInTenant(event.tenantId, async () => {
        const contextId = ContextIdFactory.create()
        const orchestrator = await this.moduleRef.resolve(CustomerCareAiOrchestratorService, contextId, { strict: false })
        return orchestrator.reply(event.aggregateId, 0, {
          triggerMessageId: this.triggerMessageId(event),
          instruction: 'Tự động soạn câu trả lời CSKH. Chỉ trả lời nếu facts đủ chắc chắn; nếu không hãy needsHuman=true.',
        })
      })

      const allowlist = this.intentAllowlist()
      const intent = normalizeCustomerCareIntent(result.intent)
      const safety = this.autoReplySafety(result, intent)
      if (result.needsHuman || !allowlist.has(intent) || !String(result.reply ?? '').trim() || !safety.ok) {
        const reason = result.needsHuman
          ? 'needs-human'
          : !allowlist.has(intent)
            ? `intent-not-allowlisted:${intent}`
            : !String(result.reply ?? '').trim()
              ? 'empty-reply'
              : safety.reason
        await this.finish(event, 'processed', reason, {
          aiJobId: result.jobId,
          aiResultId: result.resultId,
          intent,
          sent: false,
        })
        this.metrics.recordAutomation('skipped')
        return
      }

      // Re-check after model/tool latency. A newer customer message or a human
      // reply makes this draft stale even if the pre-flight check was clean.
      if (await this.hasNewerInbound(event)) {
        await this.finish(event, 'superseded', 'newer-customer-message-after-ai', {
          aiJobId: result.jobId, aiResultId: result.resultId, intent, sent: false,
        })
        this.metrics.recordAutomation('superseded')
        return
      }
      if (await this.hasAgentReplyAfter(event)) {
        await this.finish(event, 'ignored', 'agent-replied-after-ai', {
          aiJobId: result.jobId, aiResultId: result.resultId, intent, sent: false,
        })
        this.metrics.recordAutomation('skipped')
        return
      }

      await this.runInTenant(event.tenantId, async () => {
        const contextId = ContextIdFactory.create()
        const customerCare = await this.moduleRef.resolve(CustomerCareService, contextId, { strict: false })
        return customerCare.sendMessage(
          event.aggregateId,
          {
            // The inbound event id is already a UUID and remains stable across
            // retries, so a crash after provider ACK cannot create a new send.
            clientMessageId: event.eventId,
            type: 'text',
            content: String(result.reply).trim(),
          },
          0,
          false,
          event.tenantId,
        )
      })
      await this.finish(event, 'processed', 'auto-reply-sent', {
        aiJobId: result.jobId,
        aiResultId: result.resultId,
        intent,
        sent: true,
      })
      this.metrics.recordAutomation('sent')
    } catch (error) {
      this.logger.warn(`Auto-reply event ${event.eventId} failed: ${error instanceof Error ? error.message : String(error)}`)
      await this.retryOrDead(event, error)
      this.metrics.recordAutomation('failed')
    }
  }

  private runInTenant<T>(tenantId: number, fn: () => Promise<T>): Promise<T> {
    return this.cls.run(async () => {
      this.cls.set('tenantId', tenantId)
      return fn()
    })
  }

  private async hasNewerInbound(event: DomainOutboxEventEntity) {
    const count = await this.events.createQueryBuilder('event')
      .where('event.tenantId = :tenantId', { tenantId: event.tenantId })
      .andWhere('event.aggregateId = :aggregateId', { aggregateId: event.aggregateId })
      .andWhere('event.eventType = :eventType', { eventType: INBOUND_EVENT })
      .andWhere('event.id > :id', { id: event.id })
      .getCount()
    return count > 0
  }

  private async hasAgentReplyAfter(event: DomainOutboxEventEntity) {
    const count = await this.events.createQueryBuilder('outbound')
      .where('outbound.tenantId = :tenantId', { tenantId: event.tenantId })
      .andWhere('outbound.aggregateId = :aggregateId', { aggregateId: event.aggregateId })
      .andWhere('outbound.eventType = :eventType', { eventType: OUTBOUND_EVENT })
      .andWhere('outbound.createdAt > :createdAt', { createdAt: event.createdAt })
      .getCount()
    return count > 0
  }

  private triggerMessageId(event: DomainOutboxEventEntity) {
    const payload = event.payload as any
    return String(payload?.message?.id ?? payload?.message?.externalMessageId ?? event.eventId).slice(0, 220)
  }

  private intentAllowlist() {
    const raw = process.env.CUSTOMER_CARE_AI_AUTO_REPLY_INTENTS
      ?? 'ORDER_DETAILS,ORDER_TRACKING,ORDER_STATUS,PAYMENT_STATUS,SHIPPING_STATUS'
    return new Set(raw.split(',').map(normalizeCustomerCareIntent).filter(Boolean))
  }

  private autoReplySafety(result: any, intent: string): { ok: boolean; reason: string } {
    const minConfidence = this.numberEnv('CUSTOMER_CARE_AI_AUTO_REPLY_MIN_CONFIDENCE', 0.85, 0.5, 1)
    return customerCareAutoReplySafety(result, intent, minConfidence)
  }

  private numberEnv(name: string, fallback: number, min: number, max: number) {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, parsed))
  }

  private async finish(
    event: DomainOutboxEventEntity,
    status: string,
    reason: string,
    metadata: Record<string, unknown> = {},
  ) {
    await this.events.update({ id: event.id }, {
      status,
      processedAt: new Date(),
      lastError: null,
      payload: { ...(event.payload ?? {}), automation: { reason, ...metadata } },
    })
  }

  private intEnv(name: string, fallback: number, min: number, max: number) {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }

  private async retryOrDead(event: DomainOutboxEventEntity, error: unknown) {
    const maxAttempts = this.intEnv('CUSTOMER_CARE_AI_AUTOMATION_MAX_ATTEMPTS', 3, 1, 10)
    const dead = event.attempts >= maxAttempts
    const delayMs = customerCareAiRetryDelayMs(event.attempts, error)
    await this.events.update({ id: event.id }, {
      status: dead ? 'dead' : 'pending',
      availableAt: dead ? event.availableAt : new Date(Date.now() + delayMs),
      processedAt: dead ? new Date() : null,
      lastError: error instanceof Error ? error.message : String(error),
    })
  }

}
