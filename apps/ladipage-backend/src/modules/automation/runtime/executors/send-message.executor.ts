import { BadRequestException, Injectable } from '@nestjs/common'

import { AutomationMessageNormalizerService } from '../../integrations/automation-message-normalizer.service'
import { AutomationOutboundDispatchService } from '../../services/automation-outbound-dispatch.service'
import type { FlowNodeExecutor } from '../flow-node-executor'
import type { FlowNodeExecutionContext, FlowNodeExecutionResult, RuntimeFlowStep } from '../automation-runtime.types'

@Injectable()
export class AutomationSendMessageExecutor implements FlowNodeExecutor {
  readonly types = ['TEXT', 'SEND_MESSAGE', 'SENDMESSAGE'] as const

  constructor(
    private readonly outbound: AutomationOutboundDispatchService,
    private readonly messages: AutomationMessageNormalizerService,
  ) {}

  async execute(step: RuntimeFlowStep, context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult> {
    if (!context.conversationId) throw new BadRequestException('SEND_MESSAGE requires conversationId')
    const normalized = this.messages.normalize(step.config)
    const { content, attachments, messageType } = normalized
    if (!content && attachments.length === 0) {
      return { kind: 'CONTINUE', nextStepId: step.nextStepId, output: { skipped: 'empty-message', warnings: normalized.warnings } }
    }

    const dispatch = await this.outbound.request({
      tenantId: context.tenantId,
      executionId: context.executionId,
      nodeId: step.id,
      logicalIteration: context.logicalIteration,
      conversationId: context.conversationId,
      messageType,
      content,
      attachments,
    })

    if (dispatch.status === 'SENT') {
      return {
        kind: 'CONTINUE',
        nextStepId: step.nextStepId,
        output: { dispatchId: dispatch.dispatchId, clientMessageId: dispatch.clientMessageId, alreadySent: true, richMessageFallback: normalized.fallbackUsed, warnings: normalized.warnings },
      }
    }
    if (dispatch.status === 'DEAD' || dispatch.status === 'FAILED') {
      throw new Error(dispatch.lastError || 'Automation outbound dispatch failed')
    }

    return {
      kind: 'DISPATCH',
      nextStepId: step.nextStepId,
      output: { dispatchId: dispatch.dispatchId, clientMessageId: dispatch.clientMessageId, richMessageFallback: normalized.fallbackUsed, warnings: normalized.warnings },
    }
  }

}
