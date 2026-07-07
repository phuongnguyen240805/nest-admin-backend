import { Test } from '@nestjs/testing'

import { PayOsWebhookHandlers } from './payos-webhook.handlers'
import { BillingOrderService } from '../../services/billing-order.service'
import { SubscriptionService } from '../../services/subscription.service'
import {
  BillingOrderStatus,
  PaymentProvider,
} from '../../entities/billing-order.entity'
import { Period, SubscriptionTier } from '../../entities/subscription.entity'

describe('PayOsWebhookHandlers', () => {
  let handlers: PayOsWebhookHandlers
  let billingOrderService: {
    markPaid: jest.Mock
  }
  let subscriptionService: {
    updateSubscription: jest.Mock
  }

  const paidOrder = {
    id: 'order-uuid-1',
    tenantId: 1,
    organizationId: 'org-uuid-1',
    orderCode: '1000000001',
    paymentProvider: PaymentProvider.PAYOS,
    planTier: SubscriptionTier.PRO,
    period: Period.YEARLY,
    amountVnd: 2_990_000,
    currency: 'VND',
    status: BillingOrderStatus.PAID,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: undefined as any,
  }

  beforeEach(async () => {
    billingOrderService = {
      markPaid: jest.fn(),
    }
    subscriptionService = {
      updateSubscription: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [
        PayOsWebhookHandlers,
        { provide: BillingOrderService, useValue: billingOrderService },
        { provide: SubscriptionService, useValue: subscriptionService },
      ],
    }).compile()

    handlers = module.get(PayOsWebhookHandlers)
  })

  it('activates subscription on first successful payment webhook', async () => {
    billingOrderService.markPaid.mockResolvedValue({
      order: paidOrder,
      alreadyProcessed: false,
    })

    await handlers.handlePaymentSuccess({
      code: '00',
      desc: 'success',
      success: true,
      signature: 'sig',
      data: {
        orderCode: 1000000001,
        amount: 2_990_000,
        description: 'LP pro yearly',
        reference: 'TF230204212323',
      },
    })

    expect(billingOrderService.markPaid).toHaveBeenCalledWith(
      1000000001,
      'TF230204212323',
      2_990_000,
    )
    expect(subscriptionService.updateSubscription).toHaveBeenCalledWith(
      'org-uuid-1',
      expect.objectContaining({
        subscriptionTier: SubscriptionTier.PRO,
        period: Period.YEARLY,
        identifier: 'payos:1000000001',
        paymentProvider: 'payos',
        lastOrderId: 'order-uuid-1',
      }),
    )
  })

  it('skips subscription update when webhook already processed', async () => {
    billingOrderService.markPaid.mockResolvedValue({
      order: paidOrder,
      alreadyProcessed: true,
    })

    await handlers.handlePaymentSuccess({
      code: '00',
      desc: 'success',
      success: true,
      signature: 'sig',
      data: {
        orderCode: 1000000001,
        amount: 2_990_000,
        description: 'LP pro yearly',
        reference: 'TF230204212323',
      },
    })

    expect(subscriptionService.updateSubscription).not.toHaveBeenCalled()
  })
})