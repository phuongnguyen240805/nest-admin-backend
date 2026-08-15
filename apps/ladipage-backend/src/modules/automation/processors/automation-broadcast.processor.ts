import { BullMqProcessor, BaseQueueProcessor, InjectBullQueue } from '@liora/nest-core'
import { InjectRepository } from '@nestjs/typeorm'
import type { Job, Queue } from 'bullmq'
import { Repository } from 'typeorm'

import { FlowEntity } from '../entities'
import { AutomationBroadcastRuntimeService } from '../broadcast/automation-broadcast-runtime.service'
import { AUTOMATION_QUEUES } from '../queues/constants'
import { FlowExecutionService } from '../runtime/flow-execution.service'
import { isAutomationBroadcastEnabled, isAutomationTenantAllowed } from '../runtime/automation-feature-gate'

interface AutomationBroadcastJob {
  tenantId: number
  recipientId: string
}

@BullMqProcessor(AUTOMATION_QUEUES.BROADCAST)
export class AutomationBroadcastProcessor extends BaseQueueProcessor<AutomationBroadcastJob> {
  constructor(
    private readonly broadcasts: AutomationBroadcastRuntimeService,
    private readonly executions: FlowExecutionService,
    @InjectRepository(FlowEntity)
    private readonly flows: Repository<FlowEntity>,
    @InjectBullQueue(AUTOMATION_QUEUES.FLOW)
    private readonly flowQueue: Queue,
  ) { super() }

  protected async processJob(job: Job<AutomationBroadcastJob>): Promise<void> {
    const { tenantId, recipientId } = job.data
    if (!isAutomationBroadcastEnabled() || !isAutomationTenantAllowed(tenantId)) {
      await this.broadcasts.deferRecipient(tenantId, recipientId).catch(() => undefined)
      return
    }
    try {
      const recipient = await this.broadcasts.claimRecipient(tenantId, recipientId)
      if (!recipient) return
      if (recipient.flowExecutionId) {
        await this.flowQueue.add(
          'run',
          { tenantId, executionId: recipient.flowExecutionId },
          { jobId: `automation-flow-${recipient.flowExecutionId}-broadcast-recover` },
        )
        return
      }
      const broadcast = await this.broadcasts.getBroadcastForRecipient(recipient)
      if (!broadcast || !['SCHEDULED', 'SENDING'].includes(broadcast.status)) {
        await this.broadcasts.cancelRecipient(tenantId, recipientId)
        return
      }
      if (!broadcast.flowId) throw new Error('Broadcast flow_id is required')
      const flow = await this.flows.findOne({ where: { tenantId, externalId: broadcast.flowId, isDelete: false } })
      if (!flow || String(flow.status).toUpperCase() !== 'PUBLISHED') throw new Error('Broadcast flow is not published')

      const execution = await this.executions.createPending({
        tenantId,
        flowExternalId: flow.externalId,
        conversationId: recipient.conversationId,
        contactId: recipient.contactIdentityId == null ? null : String(recipient.contactIdentityId),
        triggerId: 'broadcast',
        triggerEventId: recipient.recipientId,
        context: {
          source: 'broadcast',
          broadcastId: recipient.broadcastExternalId,
          broadcastRecipientId: recipient.recipientId,
          provider: recipient.provider,
          channelAccountId: recipient.channelAccountId,
        },
      })
      await this.broadcasts.attachExecution(tenantId, recipientId, execution.executionId)
      await this.flowQueue.add(
        'run',
        { tenantId, executionId: execution.executionId },
        { jobId: `automation-flow-${execution.executionId}-broadcast` },
      )
    } catch (error) {
      const maxAttempts = Number(job.opts.attempts ?? 1)
      const finalAttempt = job.attemptsMade + 1 >= maxAttempts
      if (finalAttempt) await this.broadcasts.failRecipient(tenantId, recipientId, error).catch(() => undefined)
      throw error
    }
  }
}
