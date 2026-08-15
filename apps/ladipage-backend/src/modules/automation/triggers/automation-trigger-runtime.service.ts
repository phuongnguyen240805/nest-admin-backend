import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { InjectBullQueue } from '@liora/nest-core'
import type { Queue } from 'bullmq'
import { Repository } from 'typeorm'

import { DomainEventDeliveryService } from '../../domain-events/domain-event-delivery.service'
import { DomainEventDeliveryEntity } from '../../domain-events/entities/domain-event-delivery.entity'
import { DomainOutboxEventEntity } from '../../domain-events/entities/domain-outbox-event.entity'
import { AUTOMATION_QUEUES } from '../queues/constants'
import { isAutomationTriggerEnabled } from '../runtime/automation-feature-gate'

export const AUTOMATION_EVENT_CONSUMER = 'automation-engine'

@Injectable()
export class AutomationTriggerRuntimeService {
  private readonly logger = new Logger(AutomationTriggerRuntimeService.name)
  private running = false

  constructor(
    @InjectRepository(DomainOutboxEventEntity)
    private readonly events: Repository<DomainOutboxEventEntity>,
    private readonly deliveries: DomainEventDeliveryService,
    @InjectBullQueue(AUTOMATION_QUEUES.TRIGGER)
    private readonly triggerQueue: Queue,
  ) {}

  @Interval(2_000)
  async tick(): Promise<void> {
    if (!this.enabled() || this.running) return
    this.running = true
    try {
      const lookbackMinutes = this.intEnv('AUTOMATION_TRIGGER_LOOKBACK_MINUTES', 30, 1, 24 * 60)
      const limit = this.intEnv('AUTOMATION_TRIGGER_SCAN_LIMIT', 100, 1, 500)
      const rows = await this.events.createQueryBuilder('event')
        .leftJoin(
          DomainEventDeliveryEntity,
          'delivery',
          'delivery.event_id = event.event_id AND delivery.consumer = :consumer',
          { consumer: AUTOMATION_EVENT_CONSUMER },
        )
        .where('event.event_type = :eventType', { eventType: 'customer-care.message.inbound' })
        .andWhere("event.created_at >= NOW() - (:lookback * INTERVAL '1 minute')", { lookback: lookbackMinutes })
        .andWhere('delivery.id IS NULL')
        .orderBy('event.created_at', 'ASC')
        .take(limit)
        .getMany()

      for (const event of rows) {
        await this.triggerQueue.add(
          'evaluate',
          { tenantId: event.tenantId, eventId: event.eventId },
          { jobId: `automation-trigger-${event.eventId}` },
        )
        await this.deliveries.observe({
          eventId: event.eventId,
          tenantId: event.tenantId,
          consumer: AUTOMATION_EVENT_CONSUMER,
          status: 'queued',
          metadata: { eventType: event.eventType },
        })
      }
    } catch (error) {
      this.logger.error('Automation trigger scan failed', error instanceof Error ? error.stack : error)
    } finally {
      this.running = false
    }
  }

  private enabled(): boolean {
    return isAutomationTriggerEnabled()
  }

  private intEnv(name: string, fallback: number, min: number, max: number): number {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
