import { Injectable } from '@nestjs/common'
import type { AiToolDefinition } from '@liora/ai-gateway'

import { CustomerCareService } from '../../customer-care/customer-care.service'
import type { CustomerCareAiTool, CustomerCareAiToolContext } from './customer-care-ai-tool.types'
import { CustomerCareAiToolGuardService } from './tool-guard.service'

@Injectable()
export class CustomerAiTool implements CustomerCareAiTool {
  readonly name = 'get_customer_profile'
  constructor(
    private readonly customerCare: CustomerCareService,
    private readonly guard: CustomerCareAiToolGuardService,
  ) {}

  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy hồ sơ khách hàng của hội thoại hiện tại, gồm tên, liên hệ, tags và ghi chú CSKH.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    } }
  }

  async execute(_args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    this.guard.assertContext(context)
    const conversation = await this.customerCare.getConversation(context.conversationId, context.actorUserId)
    return (conversation as any)?.customer ?? null
  }
}
