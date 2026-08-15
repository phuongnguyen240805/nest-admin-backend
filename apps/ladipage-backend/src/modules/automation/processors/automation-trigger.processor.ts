import { BullMqProcessor, BaseQueueProcessor, InjectBullQueue } from '@liora/nest-core'
import { InjectRepository } from '@nestjs/typeorm'
import type { Job, Queue } from 'bullmq'
import { Repository } from 'typeorm'

import { DomainEventDeliveryService } from '../../domain-events/domain-event-delivery.service'
import { DomainOutboxEventEntity } from '../../domain-events/entities/domain-outbox-event.entity'
import { FlowEntity } from '../entities'
import { AUTOMATION_QUEUES } from '../queues/constants'
import { FlowExecutionService } from '../runtime/flow-execution.service'
import { isAutomationTenantAllowed, isAutomationTriggerEnabled } from '../runtime/automation-feature-gate'
import { AutomationTriggerService } from '../triggers/automation-trigger.service'
import { AUTOMATION_EVENT_CONSUMER } from '../triggers/automation-trigger-runtime.service'

interface AutomationTriggerJob {
  tenantId: number
  eventId: string
}

@BullMqProcessor(AUTOMATION_QUEUES.TRIGGER)
export class AutomationTriggerProcessor extends BaseQueueProcessor<AutomationTriggerJob> {
  constructor(
    @InjectRepository(DomainOutboxEventEntity)
    private readonly events: Repository<DomainOutboxEventEntity>,
    @InjectRepository(FlowEntity)
    private readonly flows: Repository<FlowEntity>,
    private readonly deliveries: DomainEventDeliveryService,
    private readonly triggers: AutomationTriggerService,
    private readonly executions: FlowExecutionService,
    @InjectBullQueue(AUTOMATION_QUEUES.FLOW)
    private readonly flowQueue: Queue,
  ) {
    super()
  }

  protected async processJob(job: Job<AutomationTriggerJob>): Promise<void> {
    const { tenantId, eventId } = job.data
    if (!isAutomationTriggerEnabled()) {
      await this.deliveries.mark({
        eventId, tenantId, consumer: AUTOMATION_EVENT_CONSUMER, status: 'skipped-disabled', processed: true,
      }).catch(() => undefined)
      return
    }
    if (!isAutomationTenantAllowed(tenantId)) {
      await this.deliveries.mark({
        eventId, tenantId, consumer: AUTOMATION_EVENT_CONSUMER, status: 'skipped-tenant', processed: true,
      }).catch(() => undefined)
      return
    }
    const event = await this.events.findOne({ where: { tenantId, eventId } })
    if (!event) return

    await this.deliveries.mark({ eventId, tenantId, consumer: AUTOMATION_EVENT_CONSUMER, status: 'processing' })
    try {
      const conversationId = this.conversationId(event.payload, event.aggregateId)
      let resumed = 0
      if (conversationId) resumed = await this.resumeWaitingReplies(event, conversationId)

      const shouldStartNew = resumed === 0 || process.env.AUTOMATION_TRIGGER_START_NEW_WHILE_WAITING === 'true'
      let started = 0
      if (shouldStartNew) {
        const matches = await this.triggers.matchInboundEvent({
          tenantId,
          eventType: event.eventType,
          payload: event.payload,
        })
        for (const trigger of matches) {
          const flow = await this.flows.findOne({
            where: { tenantId, externalId: trigger.flowExternalId, isDelete: false },
          })
          if (!flow || String(flow.status).toUpperCase() !== 'PUBLISHED') continue
          const execution = await this.executions.createPending({
            tenantId,
            flowExternalId: flow.externalId,
            conversationId,
            contactId: this.contactId(event.payload),
            triggerId: trigger.externalId,
            triggerEventId: event.eventId,
            context: {
              triggerEventId: event.eventId,
              triggerEventType: event.eventType,
              triggerEvent: event.payload,
            },
          })
          await this.flowQueue.add(
            'run',
            { tenantId, executionId: execution.executionId },
            { jobId: `automation-flow-${execution.executionId}` },
          )
          started += 1
        }
      }

      await this.deliveries.mark({
        eventId, tenantId, consumer: AUTOMATION_EVENT_CONSUMER, status: 'processed', processed: true,
        metadata: { resumed, started },
      })
    } catch (error) {
      await this.deliveries.mark({
        eventId, tenantId, consumer: AUTOMATION_EVENT_CONSUMER, status: 'failed',
        lastError: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined)
      throw error
    }
  }

  private async resumeWaitingReplies(event: DomainOutboxEventEntity, conversationId: string): Promise<number> {
    const waiting = await this.executions.findWaitingReplies(event.tenantId, conversationId)
    if (!waiting.length) return 0
    const replyText = this.messageText(event.payload)
    let count = 0
    for (const execution of waiting) {
      const waitingNodeId = String(execution.context?.waitingNodeId ?? '').trim()
      if (waitingNodeId) {
        await this.executions.completeStepByNode({
          tenantId: event.tenantId,
          executionId: execution.executionId,
          nodeId: waitingNodeId,
          outputPatch: { replyEventId: event.eventId, replyText },
        })
      }
      await this.executions.resume({
        tenantId: event.tenantId,
        executionId: execution.executionId,
        contextPatch: { lastInboundEventId: event.eventId, lastInboundEvent: event.payload },
        variablePatch: { lastReply: replyText },
      })
      await this.flowQueue.add(
        'run',
        { tenantId: event.tenantId, executionId: execution.executionId },
        { jobId: `automation-flow-${execution.executionId}-${event.eventId}` },
      )
      count += 1
    }
    return count
  }

  private conversationId(payload: Record<string, unknown>, aggregateId: string): string | null {
    const direct = String(payload.conversationId ?? payload.conversation_id ?? '').trim()
    if (direct) return direct
    const aggregate = String(aggregateId ?? '').trim()
    return aggregate || null
  }

  private contactId(payload: Record<string, unknown>): string | null {
    const direct = String(payload.contactId ?? payload.contact_id ?? '').trim()
    if (direct) return direct
    const message = this.record(payload.message)
    const sender = this.record(message.sender ?? payload.sender)
    const external = String(sender.external_id ?? sender.externalId ?? sender.id ?? '').trim()
    return external || null
  }

  private messageText(payload: Record<string, unknown>): string {
    const message = this.record(payload.message)
    const content = this.record(message.content)
    return String(message.text ?? message.content ?? content.text ?? payload.text ?? '')
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  }
}
