import { BadRequestException, Injectable } from '@nestjs/common'
import type { AiToolDefinition } from '@liora/ai-gateway'

import { CustomerCareService } from '../../customer-care/customer-care.service'
import type { CustomerCareAiTool, CustomerCareAiToolContext } from './customer-care-ai-tool.types'
import { CustomerCareAiToolGuardService } from './tool-guard.service'

@Injectable()
export class ConversationAiTool implements CustomerCareAiTool {
  readonly name = 'get_recent_messages'
  constructor(
    private readonly customerCare: CustomerCareService,
    private readonly guard: CustomerCareAiToolGuardService,
  ) {}

  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy các tin nhắn gần nhất của hội thoại hiện tại theo thứ tự thời gian.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } },
        additionalProperties: false,
      },
    } }
  }

  async execute(args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    this.guard.assertContext(context)
    const raw = args.limit == null ? 30 : Number(args.limit)
    if (!Number.isInteger(raw) || raw < 1 || raw > 100) throw new BadRequestException('limit must be 1..100')
    return this.customerCare.listMessages(context.conversationId, { limit: raw } as any, context.actorUserId)
  }
}

@Injectable()
export class PreviousConversationsAiTool implements CustomerCareAiTool {
  readonly name = 'list_previous_conversations'
  constructor(
    private readonly customerCare: CustomerCareService,
    private readonly guard: CustomerCareAiToolGuardService,
  ) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Liệt kê các hội thoại trước đây của cùng khách hàng.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    } }
  }
  async execute(_args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    this.guard.assertContext(context)
    return this.customerCare.previousConversations(context.conversationId, context.actorUserId)
  }
}
