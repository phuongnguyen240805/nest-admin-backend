import { Injectable } from '@nestjs/common'

import { AutomationConditionEvaluatorService } from '../condition-evaluator.service'
import type { FlowNodeExecutor } from '../flow-node-executor'
import type { FlowNodeExecutionContext, FlowNodeExecutionResult, RuntimeFlowStep } from '../automation-runtime.types'

@Injectable()
export class AutomationConditionExecutor implements FlowNodeExecutor {
  readonly types = ['CONDITION'] as const

  constructor(private readonly evaluator: AutomationConditionEvaluatorService) {}

  async execute(step: RuntimeFlowStep, context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult> {
    const matched = this.evaluator.evaluate(step.config, context.variables, context.context)
    return {
      kind: 'CONTINUE',
      nextStepId: matched ? (step.trueStepId ?? step.nextStepId) : (step.falseStepId ?? step.nextStepId),
      output: { matched },
    }
  }
}
