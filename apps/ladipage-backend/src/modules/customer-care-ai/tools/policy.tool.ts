import { Injectable } from '@nestjs/common'
import type { AiToolDefinition } from '@liora/ai-gateway'

import type { CustomerCareAiTool, CustomerCareAiToolContext } from './customer-care-ai-tool.types'
import { CustomerCareAiToolGuardService } from './tool-guard.service'

@Injectable()
export class PolicyAiTool implements CustomerCareAiTool {
  readonly name = 'get_customer_care_policy'
  constructor(private readonly guard: CustomerCareAiToolGuardService) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy chính sách CSKH được cấu hình cho hủy đơn, hoàn tiền hoặc vận chuyển. Không tự suy diễn chính sách nếu chưa cấu hình.',
      parameters: {
        type: 'object', required: ['policy'],
        properties: { policy: { type: 'string', enum: ['cancellation', 'refund', 'shipping'] } },
        additionalProperties: false,
      },
    } }
  }
  async execute(args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    this.guard.assertContext(context)
    const policy = String(args.policy ?? '')
    const envKey = policy === 'cancellation'
      ? 'CUSTOMER_CARE_CANCELLATION_POLICY'
      : policy === 'refund'
        ? 'CUSTOMER_CARE_REFUND_POLICY'
        : policy === 'shipping'
          ? 'CUSTOMER_CARE_SHIPPING_POLICY'
          : ''
    if (!envKey) return { configured: false, policy, text: null }
    const text = process.env[envKey]?.trim() || null
    return { configured: Boolean(text), policy, text }
  }
}
