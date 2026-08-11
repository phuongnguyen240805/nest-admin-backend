import { BadRequestException, Injectable } from '@nestjs/common'
import type { AiToolDefinition } from '@liora/ai-gateway'

import { ContextBudgetService } from '../../customer-care-context/context-budget.service'
import { CustomerAiTool } from './customer.tool'
import { ConversationAiTool, PreviousConversationsAiTool } from './conversation.tool'
import type { CustomerCareAiTool, CustomerCareAiToolContext } from './customer-care-ai-tool.types'
import { LinkedOrdersAiTool, OrderDetailAiTool } from './order.tool'
import { PaymentEventsAiTool, PaymentStatusAiTool } from './payment.tool'
import { PolicyAiTool } from './policy.tool'
import { ProductDetailAiTool, ProductSearchAiTool } from './product.tool'
import { ShippingEventsAiTool, ShippingStatusAiTool } from './shipping.tool'

@Injectable()
export class CustomerCareAiToolRegistry {
  private readonly toolMap: Map<string, CustomerCareAiTool>

  constructor(
    customer: CustomerAiTool,
    conversation: ConversationAiTool,
    previousConversations: PreviousConversationsAiTool,
    linkedOrders: LinkedOrdersAiTool,
    orderDetail: OrderDetailAiTool,
    paymentStatus: PaymentStatusAiTool,
    paymentEvents: PaymentEventsAiTool,
    shippingStatus: ShippingStatusAiTool,
    shippingEvents: ShippingEventsAiTool,
    productDetail: ProductDetailAiTool,
    productSearch: ProductSearchAiTool,
    policy: PolicyAiTool,
    private readonly budget: ContextBudgetService,
  ) {
    const tools = [
      customer, conversation, previousConversations, linkedOrders, orderDetail,
      paymentStatus, paymentEvents, shippingStatus, shippingEvents,
      productDetail, productSearch, policy,
    ]
    this.toolMap = new Map(tools.map((tool) => [tool.name, tool]))
  }

  definitions(): AiToolDefinition[] {
    return [...this.toolMap.values()].map((tool) => tool.definition())
  }

  has(name: string): boolean {
    return this.toolMap.has(name)
  }

  async execute(name: string, rawArgs: string | Record<string, unknown>, context: CustomerCareAiToolContext) {
    const tool = this.toolMap.get(name)
    if (!tool) throw new BadRequestException(`AI tool is not allowed: ${name}`)
    const args = typeof rawArgs === 'string' ? this.parseArgs(rawArgs) : rawArgs
    const result = await tool.execute(args, context)
    return this.budget.sanitize(result)
  }

  private parseArgs(raw: string): Record<string, unknown> {
    try {
      const parsed = raw.trim() ? JSON.parse(raw) : {}
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('arguments must be an object')
      }
      return parsed as Record<string, unknown>
    } catch {
      throw new BadRequestException('AI tool arguments are invalid JSON')
    }
  }
}
