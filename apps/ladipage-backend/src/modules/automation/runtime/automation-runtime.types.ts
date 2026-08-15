export type RuntimeGraphSchema = 'ladiflow' | 'node-graph' | 'unknown'

export interface RuntimeFlowStep {
  id: string
  type: string
  order: number
  config: Record<string, unknown>
  source: Record<string, unknown>
  nextStepId?: string
  trueStepId?: string
  falseStepId?: string
}

export interface RuntimeFlowGraph {
  schema: RuntimeGraphSchema
  triggers: Record<string, unknown>[]
  steps: RuntimeFlowStep[]
  startStepId?: string
  raw: Record<string, unknown>
}

export interface FlowGraphValidationResult extends Record<string, unknown> {
  valid: boolean
  schema: RuntimeGraphSchema
  errors: string[]
  warnings: string[]
}

export type FlowNodeExecutionKind =
  | 'CONTINUE'
  | 'WAIT'
  | 'WAIT_REPLY'
  | 'DISPATCH'
  | 'COMPLETE'

export interface FlowNodeExecutionResult {
  kind: FlowNodeExecutionKind
  nextStepId?: string | null
  waitMs?: number
  output?: Record<string, unknown>
}

export interface FlowNodeExecutionContext {
  tenantId: number
  executionId: string
  conversationId: string | null
  nodeId: string
  logicalIteration: number
  variables: Record<string, unknown>
  context: Record<string, unknown>
  nextStepId?: string
  trueStepId?: string
  falseStepId?: string
}

export interface FlowRunResult {
  executionId: string
  status: 'WAITING' | 'WAITING_REPLY' | 'COMPLETED' | 'FAILED' | 'RETRY' | 'NOOP'
  currentNodeId: string | null
  reason?: string
  waitMs?: number
  waitingNodeId?: string
  dispatchId?: string
}
