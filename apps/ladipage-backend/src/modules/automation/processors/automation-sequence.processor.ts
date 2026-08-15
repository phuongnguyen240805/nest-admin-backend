import { BullMqProcessor, BaseQueueProcessor, InjectBullQueue } from '@liora/nest-core'
import { InjectRepository } from '@nestjs/typeorm'
import type { Job, Queue } from 'bullmq'
import { Repository } from 'typeorm'

import { FlowEntity } from '../entities'
import { AUTOMATION_QUEUES } from '../queues/constants'
import { FlowExecutionService } from '../runtime/flow-execution.service'
import { isAutomationSequenceEnabled, isAutomationTenantAllowed } from '../runtime/automation-feature-gate'
import { AutomationSequenceService } from '../sequence/automation-sequence.service'

interface AutomationSequenceJob {
  tenantId: number
  dispatchId: string
}

@BullMqProcessor(AUTOMATION_QUEUES.SEQUENCE)
export class AutomationSequenceProcessor extends BaseQueueProcessor<AutomationSequenceJob> {
  constructor(
    private readonly sequences: AutomationSequenceService,
    private readonly executions: FlowExecutionService,
    @InjectRepository(FlowEntity)
    private readonly flows: Repository<FlowEntity>,
    @InjectBullQueue(AUTOMATION_QUEUES.FLOW)
    private readonly flowQueue: Queue,
  ) { super() }

  protected async processJob(job: Job<AutomationSequenceJob>): Promise<void> {
    const { tenantId, dispatchId } = job.data
    if (!isAutomationSequenceEnabled() || !isAutomationTenantAllowed(tenantId)) {
      await this.sequences.deferDispatch(tenantId, dispatchId).catch(() => undefined)
      return
    }
    try {
      const dispatch = await this.sequences.claimDispatch(tenantId, dispatchId)
      if (!dispatch) return
      if (dispatch.flowExecutionId) {
        await this.flowQueue.add(
          'run',
          { tenantId, executionId: dispatch.flowExecutionId },
          { jobId: `automation-flow-${dispatch.flowExecutionId}-sequence-recover` },
        )
        return
      }

      const sequence = await this.sequences.getSequenceForDispatch(dispatch)
      if (!sequence || sequence.status !== 'PUBLISHED' || !sequence.active) {
        await this.sequences.deferDispatch(tenantId, dispatchId)
        return
      }
      const enrollment = await this.sequences.getEnrollment(tenantId, dispatch.enrollmentId)
      if (!enrollment || enrollment.status !== 'ACTIVE') {
        await this.sequences.cancelDispatch(tenantId, dispatchId)
        return
      }
      const step = await this.sequences.getStepForDispatch(dispatch)
      if (!step) throw new Error('Sequence step not found or inactive')
      const flow = await this.flows.findOne({ where: { tenantId, externalId: step.flowExternalId, isDelete: false } })
      if (!flow || String(flow.status).toUpperCase() !== 'PUBLISHED') throw new Error('Sequence flow is not published')

      const execution = await this.executions.createPending({
        tenantId,
        flowExternalId: flow.externalId,
        conversationId: enrollment.conversationId,
        contactId: enrollment.contactIdentityId == null ? null : String(enrollment.contactIdentityId),
        triggerId: 'sequence',
        triggerEventId: dispatch.dispatchId,
        context: {
          source: 'sequence',
          sequenceId: dispatch.sequenceExternalId,
          sequenceStepId: dispatch.stepExternalId,
          sequenceDispatchId: dispatch.dispatchId,
          sequenceEnrollmentId: dispatch.enrollmentId,
        },
      })
      await this.sequences.attachExecution(tenantId, dispatchId, execution.executionId)
      await this.flowQueue.add(
        'run',
        { tenantId, executionId: execution.executionId },
        { jobId: `automation-flow-${execution.executionId}-sequence` },
      )
    } catch (error) {
      const maxAttempts = Number(job.opts.attempts ?? 1)
      const finalAttempt = job.attemptsMade + 1 >= maxAttempts
      if (finalAttempt) await this.sequences.failDispatch(tenantId, dispatchId, error).catch(() => undefined)
      throw error
    }
  }
}
