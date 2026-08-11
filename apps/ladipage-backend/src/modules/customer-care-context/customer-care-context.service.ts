import { Injectable } from '@nestjs/common'

import { CustomerCareService } from '../customer-care/customer-care.service'
import { OrderPaymentService } from '../order-payment/services/order-payment.service'
import { ShippingService } from '../ecom-store/shipping/shipping.service'
import { ContextBudgetService } from './context-budget.service'
import { CustomerCaseTimelineService } from './customer-case-timeline.service'

export interface BuildCustomerCareContextInput {
  conversationId: string
  actorUserId?: number
  recentMessageLimit?: number
  timelineLimit?: number
}

@Injectable()
export class CustomerCareContextService {
  constructor(
    private readonly customerCare: CustomerCareService,
    private readonly payments: OrderPaymentService,
    private readonly shipping: ShippingService,
    private readonly timeline: CustomerCaseTimelineService,
    private readonly budget: ContextBudgetService,
  ) {}

  async build(input: BuildCustomerCareContextInput) {
    const actorUserId = input.actorUserId ?? 0
    const [conversation, linkedOrders, recentMessagePage, previousConversations, timeline] = await Promise.all([
      this.customerCare.getConversation(input.conversationId, actorUserId),
      this.customerCare.conversationOrders(input.conversationId),
      this.customerCare.listMessages(
        input.conversationId,
        { limit: input.recentMessageLimit ?? 30 } as any,
        actorUserId,
      ),
      this.customerCare.previousConversations(input.conversationId, actorUserId).catch(() => []),
      this.timeline.getTimeline(input.conversationId, input.timelineLimit ?? 120),
    ])

    const orderContexts = await Promise.all(
      linkedOrders.map(async (order: any) => {
        const orderId = Number(order.id ?? order.orderId)
        const [orderPayments, shipment] = await Promise.all([
          this.payments.list(orderId).catch(() => []),
          this.shipping.detailForOrder(orderId).catch(() => null),
        ])
        return {
          order: this.budget.sanitize(order),
          payments: this.budget.sanitize(orderPayments),
          shipment: this.budget.sanitize(shipment),
        }
      }),
    )

    const primary = orderContexts.find(
      (item: any) => item.order?.conversationOrderLink?.isPrimary === true,
    ) ?? orderContexts[0] ?? null

    const recentMessages = this.budget.trimMessages(
      Array.isArray(recentMessagePage?.items) ? recentMessagePage.items : [],
      input.recentMessageLimit ?? 30,
    )

    return this.budget.sanitize({
      conversation,
      customer: (conversation as any)?.customer ?? null,
      primaryOrder: primary,
      linkedOrders: orderContexts,
      recentMessages,
      previousConversations: Array.isArray(previousConversations)
        ? previousConversations.slice(0, 10)
        : [],
      customerNotes: (conversation as any)?.customer?.note ?? null,
      productsReferenced: this.extractProducts(orderContexts),
      timeline,
      contextVersion: 'cc-context-v1',
      generatedAt: new Date().toISOString(),
    })
  }

  private extractProducts(orderContexts: Array<any>) {
    const seen = new Set<string>()
    const products: Array<Record<string, unknown>> = []
    for (const item of orderContexts) {
      for (const orderItem of item.order?.items ?? []) {
        const key = String(orderItem.productId ?? orderItem.productName ?? '')
        if (!key || seen.has(key)) continue
        seen.add(key)
        products.push({
          productId: orderItem.productId ?? null,
          name: orderItem.productName ?? null,
          quantity: orderItem.quantity ?? null,
          unitPrice: orderItem.unitPrice != null ? Number(orderItem.unitPrice) : null,
        })
      }
    }
    return products.slice(0, 50)
  }
}
