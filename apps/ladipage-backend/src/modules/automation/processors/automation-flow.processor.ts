import { BullMqProcessor, BaseQueueProcessor, InjectBullQueue } from '@liora/nest-core'
import type { Job, Queue } from 'bullmq'

import { AUTOMATION_QUEUES } from '../queues/constants'
import { FlowRuntimeService } from '../runtime/flow-runtime.service'
import { isAutomationRuntimeEnabled, isAutomationTenantAllowed } from '../runtime/automation-feature-gate'

interface AutomationFlowJob {
  tenantId: number
  executionId: string
}

@BullMqProcessor(AUTOMATION_QUEUES.FLOW)
export class AutomationFlowProcessor extends BaseQueueProcessor<AutomationFlowJob> {
  constructor(
    private readonly runtime: FlowRuntimeService,
    @InjectBullQueue(AUTOMATION_QUEUES.RESUME)
    private readonly resumeQueue: Queue,
  ) {
    super()
  }

  protected async processJob(job: Job<AutomationFlowJob>): Promise<void> {
    if (!isAutomationRuntimeEnabled() || !isAutomationTenantAllowed(job.data.tenantId)) return
    const maxAttempts = Number(job.opts.attempts ?? 1)
    const finalAttempt = job.attemptsMade + 1 >= maxAttempts
    const result = await this.runtime.run(job.data.tenantId, job.data.executionId, { terminalOnError: finalAttempt })
    if (result.status === 'RETRY') throw new Error(result.reason || 'Automation flow execution retry requested')
    if (result.status !== 'WAITING' || result.reason !== 'timer' || !result.waitingNodeId) return
    const delay = Math.max(0, Number(result.waitMs ?? 0))
    await this.resumeQueue.add(
      'timer',
      { tenantId: job.data.tenantId, executionId: job.data.executionId, waitingNodeId: result.waitingNodeId },
      { jobId: `automation-resume-${job.data.executionId}-${result.waitingNodeId}`, delay },
    )
  }
}
