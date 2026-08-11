import { BadRequestException, Injectable } from '@nestjs/common'
import type { AiToolDefinition } from '@liora/ai-gateway'

import { OrderPaymentService } from '../../order-payment/services/order-payment.service'
import type { CustomerCareAiTool, CustomerCareAiToolContext } from './customer-care-ai-tool.types'
import { CustomerCareAiToolGuardService } from './tool-guard.service'

@Injectable()
export class PaymentStatusAiTool implements CustomerCareAiTool {
  readonly name = 'get_order_payments'
  constructor(
    private readonly payments: OrderPaymentService,
    private readonly guard: CustomerCareAiToolGuardService,
  ) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy toàn bộ trạng thái thanh toán của một đơn đã liên kết với hội thoại.',
      parameters: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'integer', minimum: 1 } }, additionalProperties: false },
    } }
  }
  async execute(args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    const orderId = Number(args.orderId)
    if (!Number.isInteger(orderId)) throw new BadRequestException('orderId is required')
    await this.guard.requireLinkedOrder(context, orderId)
    return this.payments.list(orderId)
  }
}

@Injectable()
export class PaymentEventsAiTool implements CustomerCareAiTool {
  readonly name = 'get_payment_events'
  constructor(
    private readonly payments: OrderPaymentService,
    private readonly guard: CustomerCareAiToolGuardService,
  ) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy lịch sử sự kiện của một payment thuộc đơn đang được hội thoại thảo luận.',
      parameters: {
        type: 'object', required: ['orderId', 'paymentId'],
        properties: { orderId: { type: 'integer', minimum: 1 }, paymentId: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    } }
  }
  async execute(args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    const orderId = Number(args.orderId), paymentId = Number(args.paymentId)
    if (!Number.isInteger(orderId) || !Number.isInteger(paymentId)) throw new BadRequestException('orderId and paymentId are required')
    await this.guard.requireLinkedOrder(context, orderId)
    return this.payments.events(orderId, paymentId)
  }
}
