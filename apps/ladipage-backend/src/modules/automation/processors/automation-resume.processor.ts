import { BullMqProcessor, BaseQueueProcessor, InjectBullQueue } from '@liora/nest-core'
import type { Job, Queue } from 'bullmq'

import { AUTOMATION_QUEUES } from '../queues/constants'
import { FlowExecutionService } from '../runtime/flow-execution.service'
import { isAutomationRuntimeEnabled, isAutomationTenantAllowed } from '../runtime/automation-feature-gate'

interface AutomationResumeJob {
  tenantId: number
  executionId: string
  waitingNodeId: string
}

@BullMqProcessor(AUTOMATION_QUEUES.RESUME)
export class AutomationResumeProcessor extends BaseQueueProcessor<AutomationResumeJob> {
  constructor(
    private readonly executions: FlowExecutionService,
    @InjectBullQueue(AUTOMATION_QUEUES.FLOW)
    private readonly flowQueue: Queue,
  ) { super() }

  protected async processJob(job: Job<AutomationResumeJob>): Promise<void> {
    const { tenantId, executionId, waitingNodeId } = job.data
    if (!isAutomationRuntimeEnabled() || !isAutomationTenantAllowed(tenantId)) return
    const execution = await this.executions.find(tenantId, executionId)
    if (!execution || execution.status !== 'WAITING') return
    if (String(execution.context?.waitingReason ?? '') !== 'timer') return
    if (String(execution.context?.waitingNodeId ?? '') !== waitingNodeId) return

    await this.executions.completeStepByNode({
      tenantId, executionId, nodeId: waitingNodeId, outputPatch: { resumedAt: new Date().toISOString() },
    })
    await this.executions.resume({
      tenantId, executionId, contextPatch: { waitingNodeId: null, waitingReason: null },
    })
    await this.flowQueue.add(
      'run',
      { tenantId, executionId },
      { jobId: `automation-flow-${executionId}-timer-${Date.now()}` },
    )
  }
}
