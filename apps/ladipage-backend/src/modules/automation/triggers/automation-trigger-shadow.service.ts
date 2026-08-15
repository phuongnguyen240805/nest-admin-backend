import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { DomainEventDeliveryService } from '../../domain-events/domain-event-delivery.service'
import { DomainOutboxEventEntity } from '../../domain-events/entities/domain-outbox-event.entity'
import { AutomationTriggerService } from './automation-trigger.service'

const CONSUMER = 'automation-shadow'
const INBOUND_EVENT = 'customer-care.message.inbound'

@Injectable()
export class AutomationTriggerShadowService {
  private readonly logger = new Logger(AutomationTriggerShadowService.name)
  private running = false

  constructor(
    @InjectRepository(DomainOutboxEventEntity)
    private readonly events: Repository<DomainOutboxEventEntity>,
    private readonly deliveries: DomainEventDeliveryService,
    private readonly triggers: AutomationTriggerService,
  ) {}

  @Interval(5_000)
  async poll(): Promise<void> {
    if (!this.enabled() || this.running) return
    this.running = true
    try {
      const batchSize = this.intEnv('AUTOMATION_TRIGGER_SHADOW_BATCH_SIZE', 20, 1, 100)
      const lookbackMinutes = this.intEnv('AUTOMATION_TRIGGER_SHADOW_LOOKBACK_MINUTES', 10, 1, 1440)
      const since = new Date(Date.now() - lookbackMinutes * 60_000)
      const events = await this.events.createQueryBuilder('event')
        .where('event.eventType = :eventType', { eventType: INBOUND_EVENT })
        .andWhere('event.createdAt >= :since', { since })
        .andWhere(`NOT EXISTS (
          SELECT 1 FROM "domain_event_delivery" delivery
          WHERE delivery."event_id" = event."event_id"
            AND delivery."consumer" = :consumer
        )`, { consumer: CONSUMER })
        .orderBy('event.id', 'ASC')
        .take(batchSize)
        .getMany()

      for (const event of events) await this.observe(event)
    } catch (error) {
      this.logger.warn(`Automation shadow poll failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.running = false
    }
  }

  private async observe(event: DomainOutboxEventEntity) {
    try {
      const matches = await this.triggers.matchInboundEvent({
        tenantId: event.tenantId,
        eventType: event.eventType,
        payload: event.payload ?? {},
      })
      await this.deliveries.observe({
        eventId: event.eventId,
        tenantId: event.tenantId,
        consumer: CONSUMER,
        status: matches.length ? 'would_match' : 'observed',
        metadata: {
          sourceEventType: event.eventType,
          aggregateId: event.aggregateId,
          matchedTriggerIds: matches.map((trigger) => trigger.externalId),
          matchedFlowIds: matches.map((trigger) => trigger.flowExternalId),
          shadow: true,
        },
      })
      if (matches.length) {
        this.logger.debug(`WOULD_MATCH event=${event.eventId} tenant=${event.tenantId} triggers=${matches.map((item) => item.externalId).join(',')}`)
      }
    } catch (error) {
      await this.deliveries.observe({
        eventId: event.eventId,
        tenantId: event.tenantId,
        consumer: CONSUMER,
        status: 'failed',
        metadata: { shadow: true, error: error instanceof Error ? error.message : String(error) },
      }).catch(() => undefined)
    }
  }

  private enabled() {
    return process.env.AUTOMATION_ENABLED === 'true'
      && process.env.AUTOMATION_TRIGGER_SHADOW === 'true'
      && process.env.AUTOMATION_TRIGGER_ENABLED !== 'true'
  }

  private intEnv(name: string, fallback: number, min: number, max: number) {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
