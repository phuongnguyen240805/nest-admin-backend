import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

import { BillingOrderService } from './billing-order.service'
import {
  BillingOrder,
  BillingOrderStatus,
  PaymentProvider,
} from '../entities/billing-order.entity'
import { Period, SubscriptionTier } from '../entities/subscription.entity'

describe('BillingOrderService', () => {
  let service: BillingOrderService
  let orderRepo: {
    create: jest.Mock
    save: jest.Mock
    findOne: jest.Mock
    update: jest.Mock
  }
  let dataSource: { query: jest.Mock }

  const baseOrder: BillingOrder = {
    id: 'order-uuid-1',
    tenantId: 1,
    organizationId: 'org-uuid-1',
    orderCode: '1000000001',
    paymentProvider: PaymentProvider.PAYOS,
    planTier: SubscriptionTier.PRO,
    period: Period.YEARLY,
    amountVnd: 2_990_000,
    currency: 'VND',
    status: BillingOrderStatus.PENDING,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: undefined as any,
  }

  beforeEach(async () => {
    orderRepo = {
      create: jest.fn(input => ({ ...input, id: baseOrder.id })),
      save: jest.fn(async order => ({ ...baseOrder, ...order })),
      findOne: jest.fn(),
      update: jest.fn(),
    }
    dataSource = {
      query: jest.fn().mockResolvedValue([{ code: '1000000002' }]),
    }

    const module = await Test.createTestingModule({
      providers: [
        BillingOrderService,
        { provide: getRepositoryToken(BillingOrder), useValue: orderRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()

    service = module.get(BillingOrderService)
  })

  it('creates pending order with sequence orderCode', async () => {
    const order = await service.createPendingOrder({
      tenantId: 1,
      organizationId: 'org-uuid-1',
      planTier: SubscriptionTier.PRO,
      period: Period.YEARLY,
      amountVnd: 2_990_000,
    })

    expect(dataSource.query).toHaveBeenCalled()
    expect(order.orderCode).toBe('1000000002')
    expect(order.status).toBe(BillingOrderStatus.PENDING)
  })

  it('markPaid is idempotent when order already paid', async () => {
    orderRepo.findOne.mockResolvedValue({
      ...baseOrder,
      status: BillingOrderStatus.PAID,
      paidAt: new Date(),
    })

    const result = await service.markPaid(1000000001, 'TF230204212323', 2_990_000)

    expect(result.alreadyProcessed).toBe(true)
    expect(orderRepo.update).not.toHaveBeenCalled()
  })

  it('markPaid updates pending order once', async () => {
    orderRepo.findOne
      .mockResolvedValueOnce({ ...baseOrder, status: BillingOrderStatus.PENDING })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...baseOrder,
        status: BillingOrderStatus.PAID,
        paidAt: new Date(),
        webhookEventId: 'TF230204212323',
      })

    const result = await service.markPaid(1000000001, 'TF230204212323', 2_990_000)

    expect(result.alreadyProcessed).toBe(false)
    expect(orderRepo.update).toHaveBeenCalledWith(
      { id: baseOrder.id },
      expect.objectContaining({
        status: BillingOrderStatus.PAID,
        webhookEventId: 'TF230204212323',
      }),
    )
  })

  it('rejects amount mismatch', async () => {
    orderRepo.findOne.mockResolvedValue({
      ...baseOrder,
      status: BillingOrderStatus.PENDING,
    })

    await expect(
      service.markPaid(1000000001, 'TF230204212323', 1),
    ).rejects.toThrow('Payment amount does not match order')
  })
})