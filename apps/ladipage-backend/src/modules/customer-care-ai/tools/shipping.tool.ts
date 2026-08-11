import { BadRequestException, Injectable } from '@nestjs/common'
import type { AiToolDefinition } from '@liora/ai-gateway'

import { ShippingService } from '../../ecom-store/shipping/shipping.service'
import type { CustomerCareAiTool, CustomerCareAiToolContext } from './customer-care-ai-tool.types'
import { CustomerCareAiToolGuardService } from './tool-guard.service'

@Injectable()
export class ShippingStatusAiTool implements CustomerCareAiTool {
  readonly name = 'get_shipping_status'
  constructor(
    private readonly shipping: ShippingService,
    private readonly guard: CustomerCareAiToolGuardService,
  ) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy trạng thái vận chuyển/tracking của một đơn đã liên kết với hội thoại.',
      parameters: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'integer', minimum: 1 } }, additionalProperties: false },
    } }
  }
  async execute(args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    const orderId = Number(args.orderId)
    if (!Number.isInteger(orderId)) throw new BadRequestException('orderId is required')
    await this.guard.requireLinkedOrder(context, orderId)
    return this.shipping.detailForOrder(orderId)
  }
}

@Injectable()
export class ShippingEventsAiTool implements CustomerCareAiTool {
  readonly name = 'get_shipment_events'
  constructor(
    private readonly shipping: ShippingService,
    private readonly guard: CustomerCareAiToolGuardService,
  ) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy timeline sự kiện vận chuyển của một đơn đã liên kết với hội thoại.',
      parameters: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'integer', minimum: 1 } }, additionalProperties: false },
    } }
  }
  async execute(args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    const orderId = Number(args.orderId)
    if (!Number.isInteger(orderId)) throw new BadRequestException('orderId is required')
    await this.guard.requireLinkedOrder(context, orderId)
    return this.shipping.events(orderId)
  }
}
