import { Injectable } from '@nestjs/common'

import { CustomerCareService } from '../../customer-care/customer-care.service'
import { OrderBusinessStatus, OrderFulfillmentStatus } from '../../ecom-store/common/enums'

export const CUSTOMER_CARE_AI_ACTION_TYPES = [
  'PROPOSE_CREATE_ORDER',
  'PROPOSE_CANCEL_ORDER',
  'PROPOSE_CHANGE_ADDRESS',
  'PROPOSE_CHANGE_PRODUCT',
  'PROPOSE_REFUND',
  'PROPOSE_RESEND_PAYMENT',
  'PROPOSE_ESCALATION',
] as const

export type CustomerCareAiActionType = typeof CUSTOMER_CARE_AI_ACTION_TYPES[number]

export interface CustomerCareAiActionPolicyResult {
  allowedToPropose: boolean
  executable: boolean
  riskLevel: 'low' | 'medium' | 'high'
  reason: string
  orderId?: number
  requiresRefundReview?: boolean
}

@Injectable()
export class CustomerCareAiActionPolicyService {
  constructor(private readonly customerCare: CustomerCareService) {}

  async evaluate(
    conversationId: string,
    actionType: string,
    args: Record<string, unknown>,
  ): Promise<CustomerCareAiActionPolicyResult> {
    if (!CUSTOMER_CARE_AI_ACTION_TYPES.includes(actionType as CustomerCareAiActionType)) {
      return { allowedToPropose: false, executable: false, riskLevel: 'high', reason: 'Action type is not allowlisted' }
    }

    if (actionType === 'PROPOSE_ESCALATION') {
      return { allowedToPropose: true, executable: false, riskLevel: 'low', reason: 'Escalation requires normal agent workflow' }
    }

    if (actionType === 'PROPOSE_CREATE_ORDER') {
      return { allowedToPropose: true, executable: false, riskLevel: 'medium', reason: 'Order creation remains an agent-driven workflow' }
    }

    const orderId = Number(args.orderId)
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return { allowedToPropose: false, executable: false, riskLevel: 'high', reason: 'A valid linked orderId is required' }
    }

    const linkedOrders = await this.customerCare.conversationOrders(conversationId)
    const order = linkedOrders.find((item: any) => Number(item.id ?? item.orderId) === orderId) as any
    if (!order) {
      return { allowedToPropose: false, executable: false, riskLevel: 'high', reason: 'Order is not linked to this conversation', orderId }
    }

    if (actionType !== 'PROPOSE_CANCEL_ORDER') {
      return {
        allowedToPropose: true,
        executable: false,
        riskLevel: actionType === 'PROPOSE_REFUND' ? 'high' : 'medium',
        reason: 'This action is proposal-only until a dedicated application service is implemented',
        orderId,
      }
    }

    const businessStatus = String(order.businessStatus ?? '')
    const fulfillmentStatus = String(order.fulfillmentStatus ?? '')
    if ([OrderBusinessStatus.CANCELLED, OrderBusinessStatus.COMPLETED, OrderBusinessStatus.SPAM].includes(businessStatus as OrderBusinessStatus)) {
      return { allowedToPropose: false, executable: false, riskLevel: 'high', reason: `Order cannot be cancelled from business status ${businessStatus}`, orderId }
    }
    if ([
      OrderFulfillmentStatus.SHIPPED,
      OrderFulfillmentStatus.IN_TRANSIT,
      OrderFulfillmentStatus.DELIVERING,
      OrderFulfillmentStatus.DELIVERED,
      OrderFulfillmentStatus.RETURNING,
      OrderFulfillmentStatus.RETURNED,
    ].includes(fulfillmentStatus as OrderFulfillmentStatus)) {
      return { allowedToPropose: false, executable: false, riskLevel: 'high', reason: `Order cannot be cancelled from fulfillment status ${fulfillmentStatus}`, orderId }
    }

    return {
      allowedToPropose: true,
      executable: true,
      riskLevel: 'high',
      reason: 'Cancellation is eligible but requires explicit agent approval',
      orderId,
      requiresRefundReview: String(order.paymentStatus ?? '') === 'PAID',
    }
  }
}
