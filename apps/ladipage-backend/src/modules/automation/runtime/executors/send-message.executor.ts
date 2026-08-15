import { BadRequestException, Injectable } from '@nestjs/common'

import { AutomationOutboundDispatchService } from '../../services/automation-outbound-dispatch.service'
import type { FlowNodeExecutor } from '../flow-node-executor'
import type { FlowNodeExecutionContext, FlowNodeExecutionResult, RuntimeFlowStep } from '../automation-runtime.types'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationSendMessageExecutor implements FlowNodeExecutor {
  readonly types = ['TEXT', 'SEND_MESSAGE'] as const

  constructor(private readonly outbound: AutomationOutboundDispatchService) {}

  async execute(step: RuntimeFlowStep, context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult> {
    if (!context.conversationId) throw new BadRequestException('SEND_MESSAGE requires conversationId')
    const config = this.record(step.config)
    const message = this.record(config.message)
    const nestedContent = this.record(message.content)
    const nestedMessage = this.record(nestedContent.message)
    const content = this.firstString(
      config.text,
      config.content,
      message.text,
      nestedMessage.text,
      message.title,
    )
    const attachments = this.numberArray(config.attachments ?? message.attachments)
    if (!content && attachments.length === 0) {
      return { kind: 'CONTINUE', nextStepId: step.nextStepId, output: { skipped: 'empty-message' } }
    }

    const dispatch = await this.outbound.request({
      tenantId: context.tenantId,
      executionId: context.executionId,
      nodeId: step.id,
      logicalIteration: context.logicalIteration,
      conversationId: context.conversationId,
      messageType: this.firstString(config.messageType, config.message_type, message.type)?.toLowerCase() || 'text',
      content,
      attachments,
    })

    if (dispatch.status === 'SENT') {
      return {
        kind: 'CONTINUE',
        nextStepId: step.nextStepId,
        output: { dispatchId: dispatch.dispatchId, clientMessageId: dispatch.clientMessageId, alreadySent: true },
      }
    }
    if (dispatch.status === 'DEAD' || dispatch.status === 'FAILED') {
      throw new Error(dispatch.lastError || 'Automation outbound dispatch failed')
    }

    return {
      kind: 'DISPATCH',
      nextStepId: step.nextStepId,
      output: { dispatchId: dispatch.dispatchId, clientMessageId: dispatch.clientMessageId },
    }
  }

  private firstString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
  }

  private numberArray(value: unknown): number[] {
    return Array.isArray(value)
      ? value.map(Number).filter((item) => Number.isInteger(item) && item > 0)
      : []
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }
}
