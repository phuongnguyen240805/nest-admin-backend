import { Injectable } from '@nestjs/common'

import type { FlowNodeExecutor } from '../flow-node-executor'
import type { FlowNodeExecutionContext, FlowNodeExecutionResult, RuntimeFlowStep } from '../automation-runtime.types'

@Injectable()
export class AutomationControlExecutor implements FlowNodeExecutor {
  readonly types = ['START', 'NEXT_STEP', 'END'] as const

  async execute(step: RuntimeFlowStep, _context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult> {
    if (step.type === 'END') return { kind: 'COMPLETE', nextStepId: null, output: {} }
    return { kind: 'CONTINUE', nextStepId: step.nextStepId, output: {} }
  }
}
