import { BadRequestException, Injectable } from '@nestjs/common'

import { AutomationActionDispatchService } from '../../actions/automation-action-dispatch.service'
import type { FlowNodeExecutionContext, FlowNodeExecutionResult, RuntimeFlowStep } from '../automation-runtime.types'
import { isAutomationActionsEnabled } from '../automation-feature-gate'
import type { FlowNodeExecutor } from '../flow-node-executor'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationActionExecutor implements FlowNodeExecutor {
  readonly types = [
    'ACTION',
    'PERFORM_ACTION',
    'HTTP_REQUEST',
    'CALL_API',
    'WEBHOOK',
    'ADD_TAG',
    'ADD_CONTACT_TAG',
    'REMOVE_TAG',
    'REMOVE_CONTACT_TAG',
    'ASSIGN_AGENT',
    'ASSIGN_CONVERSATION',
    'UNASSIGN_AGENT',
    'UNASSIGN_CONVERSATION',
    'SET_CUSTOM_FIELD',
    'CREATE_ORDER',
    'UPDATE_ORDER',
    'CREATE_PAYMENT',
    'CHECK_PAYMENT',
    'BOOK_SHIPPING',
    'CHECK_SHIPPING',
    'AI_REPLY',
    'AI_ANALYZE',
  ] as const

  constructor(private readonly actions: AutomationActionDispatchService) {}

  async execute(step: RuntimeFlowStep, context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult> {
    if (!isAutomationActionsEnabled()) throw new BadRequestException('Automation actions are disabled')

    const config = this.record(step.config)
    const actionType = this.actionType(step.type, config)
    const payload = this.actionPayload(step.type, config)
    const resultVariable = this.firstString(config.resultVariable, config.outputVariable, payload.resultVariable)

    if (!actionType) throw new BadRequestException('Automation action type is required')

    const dispatch = await this.actions.request({
      tenantId: context.tenantId,
      executionId: context.executionId,
      nodeId: context.nodeId,
      logicalIteration: context.logicalIteration,
      conversationId: context.conversationId,
      actionType,
      payload,
      resultVariable,
    })

    if (dispatch.status === 'COMPLETED') {
      return {
        kind: 'CONTINUE',
        nextStepId: step.nextStepId ?? context.nextStepId ?? null,
        output: {
          actionDispatchId: dispatch.dispatchId,
          actionResult: dispatch.result ?? {},
          variables: resultVariable ? { [resultVariable]: dispatch.result ?? {} } : {},
        },
      }
    }

    if (dispatch.status === 'DEAD' || dispatch.status === 'FAILED') {
      throw new Error(dispatch.lastError || `Automation action ${actionType} failed`)
    }

    return {
      kind: 'DISPATCH',
      nextStepId: step.nextStepId ?? context.nextStepId ?? null,
      output: { dispatchId: dispatch.dispatchId, actionType },
    }
  }

  private actionType(stepType: string, config: JsonRecord): string {
    const normalizedStep = this.normalize(stepType)
    if (normalizedStep !== 'ACTION' && normalizedStep !== 'PERFORM_ACTION') return normalizedStep

    const details = this.record(config.details)
    const direct = this.firstString(config.actionType, config.action, config.type, details.actionType, details.action)
    if (direct) return this.normalize(direct)

    const steps = this.array(config.steps ?? details.steps)
    if (steps.length) return 'BATCH'
    return ''
  }

  private actionPayload(stepType: string, config: JsonRecord): JsonRecord {
    const normalizedStep = this.normalize(stepType)
    if (normalizedStep !== 'ACTION' && normalizedStep !== 'PERFORM_ACTION') return config

    const details = this.record(config.details)
    const steps = this.array(config.steps ?? details.steps)
    if (steps.length) return { ...config, steps }
    return Object.keys(details).length ? { ...config, ...details } : config
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
  }

  private firstString(...values: unknown[]): string | null {
    for (const value of values) {
      const text = String(value ?? '').trim()
      if (text) return text
    }
    return null
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
  }
}
