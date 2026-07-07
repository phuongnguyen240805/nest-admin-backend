import { Injectable, Logger } from '@nestjs/common'

import { Period, SubscriptionTier } from '../../entities/subscription.entity'
import { BillingOrderService } from '../../services/billing-order.service'
import { SubscriptionService } from '../../services/subscription.service'
import { PayOsWebhookHandler } from '../decorators/payos-webhook-handler.decorator'
import type { PayOsWebhookPayload } from '../dto/payos-webhook-payload.dto'

@Injectable()
export class PayOsWebhookHandlers {
  private readonly logger = new Logger(PayOsWebhookHandlers.name)

  constructor(
    private readonly billingOrderService: BillingOrderService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @PayOsWebhookHandler('payment.success')
  async handlePaymentSuccess(payload: PayOsWebhookPayload) {
    const { orderCode, amount, reference } = payload.data
    const webhookEventId = reference || `payos:${orderCode}:${payload.signature}`

    this.logger.log(`PayOS payment success for order ${orderCode}`)

    const { order, alreadyProcessed } = await this.billingOrderService.markPaid(
      orderCode,
      webhookEventId,
      amount,
    )

    if (alreadyProcessed) {
      this.logger.log(`Order ${orderCode} already processed, skipping activation`)
      return
    }

    const tier = order.planTier as SubscriptionTier
    const period = order.period as Period

    await this.subscriptionService.updateSubscription(order.organizationId, {
      subscriptionTier: tier,
      period,
      identifier: `payos:${order.orderCode}`,
      paymentProvider: 'payos',
      lastOrderId: order.id,
      isLifetime: tier === SubscriptionTier.LIFETIME,
      cancelAt: undefined,
    })

    this.logger.log(
      `Activated subscription for org ${order.organizationId}: ${tier}/${period}`,
    )
  }
}