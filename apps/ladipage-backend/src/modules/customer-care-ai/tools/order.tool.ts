import { BadRequestException, Injectable } from '@nestjs/common'
import type { AiToolDefinition } from '@liora/ai-gateway'

import type { CustomerCareAiTool, CustomerCareAiToolContext } from './customer-care-ai-tool.types'
import { CustomerCareAiToolGuardService } from './tool-guard.service'

@Injectable()
export class LinkedOrdersAiTool implements CustomerCareAiTool {
  readonly name = 'get_linked_orders'
  constructor(private readonly guard: CustomerCareAiToolGuardService) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy các đơn hàng đã được liên kết xác định với hội thoại hiện tại.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    } }
  }
  execute(_args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    return this.guard.linkedOrders(context)
  }
}

@Injectable()
export class OrderDetailAiTool implements CustomerCareAiTool {
  readonly name = 'get_order_detail'
  constructor(private readonly guard: CustomerCareAiToolGuardService) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy chi tiết một đơn hàng, chỉ khi đơn đó đã liên kết với hội thoại hiện tại.',
      parameters: {
        type: 'object', required: ['orderId'],
        properties: { orderId: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    } }
  }
  async execute(args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    const orderId = Number(args.orderId)
    if (!Number.isInteger(orderId)) throw new BadRequestException('orderId is required')
    return this.guard.requireLinkedOrder(context, orderId)
  }
}
