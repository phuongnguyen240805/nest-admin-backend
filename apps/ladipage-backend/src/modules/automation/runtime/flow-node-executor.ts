import type {
  FlowNodeExecutionContext,
  FlowNodeExecutionResult,
  RuntimeFlowStep,
} from './automation-runtime.types'

export interface FlowNodeExecutor {
  readonly types: readonly string[]
  execute(step: RuntimeFlowStep, context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult>
}
