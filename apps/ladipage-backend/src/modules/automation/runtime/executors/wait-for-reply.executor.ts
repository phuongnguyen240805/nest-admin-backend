import { Injectable } from '@nestjs/common'

import type { FlowNodeExecutor } from '../flow-node-executor'
import type { FlowNodeExecutionContext, FlowNodeExecutionResult, RuntimeFlowStep } from '../automation-runtime.types'

@Injectable()
export class AutomationWaitForReplyExecutor implements FlowNodeExecutor {
  readonly types = ['WAIT_FOR_REPLY'] as const

  async execute(step: RuntimeFlowStep, _context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult> {
    return { kind: 'WAIT_REPLY', nextStepId: step.nextStepId, output: { waitingForReply: true } }
  }
}
