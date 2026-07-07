import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import type { BillingOrderStatusDto } from '@liora/api-types'

import {
  BillingOrder,
  BillingOrderStatus,
  PaymentProvider,
} from '../entities/billing-order.entity'
import { Period, SubscriptionTier } from '../entities/subscription.entity'

export interface CreatePendingOrderInput {
  tenantId: number
  organizationId: string
  planTier: SubscriptionTier
  period: Period
  amountVnd: number
  description?: string
  expiresAt?: Date
}

export interface MarkPaidResult {
  order: BillingOrder
  alreadyProcessed: boolean
}

@Injectable()
export class BillingOrderService {
  private readonly logger = new Logger(BillingOrderService.name)

  constructor(
    @InjectRepository(BillingOrder)
    private readonly orderRepo: Repository<BillingOrder>,
    private readonly dataSource: DataSource,
  ) {}

  async nextOrderCode(): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT nextval('billing_order_code_seq')::bigint AS code`,
    )
    return Number(rows[0]?.code)
  }

  async createPendingOrder(input: CreatePendingOrderInput): Promise<BillingOrder> {
    const orderCode = await this.nextOrderCode()

    const order = this.orderRepo.create({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      orderCode: String(orderCode),
      paymentProvider: PaymentProvider.PAYOS,
      planTier: input.planTier,
      period: input.period,
      amountVnd: input.amountVnd,
      currency: 'VND',
      status: BillingOrderStatus.PENDING,
      description: input.description,
      expiresAt: input.expiresAt,
    })

    return this.orderRepo.save(order)
  }

  async attachPayOsLink(
    orderId: string,
    link: {
      paymentLinkId: string
      checkoutUrl: string
      qrCode: string
      expiresAt?: Date
    },
  ): Promise<BillingOrder> {
    await this.orderRepo.update(
      { id: orderId },
      {
        payosPaymentLinkId: link.paymentLinkId,
        payosCheckoutUrl: link.checkoutUrl,
        payosQrCode: link.qrCode,
        expiresAt: link.expiresAt,
      },
    )

    return this.getById(orderId)
  }

  async getByOrderCode(orderCode: number | string): Promise<BillingOrder | null> {
    return this.orderRepo.findOne({
      where: { orderCode: String(orderCode) },
    })
  }

  async getById(id: string): Promise<BillingOrder> {
    const order = await this.orderRepo.findOne({ where: { id } })
    if (!order)
      throw new NotFoundException(`Billing order ${id} not found`)
    return order
  }

  async getOrderStatus(
    orderCode: number | string,
    organizationId?: string,
  ): Promise<BillingOrderStatusDto> {
    const order = await this.getByOrderCode(orderCode)
    if (!order)
      throw new NotFoundException(`Order ${orderCode} not found`)

    if (organizationId && order.organizationId !== organizationId) {
      throw new NotFoundException(`Order ${orderCode} not found`)
    }

    return this.toStatusDto(order)
  }

  toStatusDto(order: BillingOrder): BillingOrderStatusDto {
    return {
      orderCode: Number(order.orderCode),
      status: order.status as BillingOrderStatusDto['status'],
      planTier: order.planTier as BillingOrderStatusDto['planTier'],
      period: order.period as BillingOrderStatusDto['period'],
      paidAt: order.paidAt?.toISOString(),
    }
  }

  async markPaid(
    orderCode: number | string,
    webhookEventId: string,
    paidAmount?: number,
  ): Promise<MarkPaidResult> {
    const order = await this.getByOrderCode(orderCode)
    if (!order)
      throw new NotFoundException(`Order ${orderCode} not found`)

    if (order.status === BillingOrderStatus.PAID) {
      return { order, alreadyProcessed: true }
    }

    if (paidAmount != null && paidAmount !== order.amountVnd) {
      this.logger.warn(
        `Amount mismatch for order ${orderCode}: expected ${order.amountVnd}, got ${paidAmount}`,
      )
      throw new BadRequestException('Payment amount does not match order')
    }

    const existingByWebhook = webhookEventId
      ? await this.orderRepo.findOne({ where: { webhookEventId } })
      : null

    if (existingByWebhook && existingByWebhook.id !== order.id) {
      this.logger.warn(
        `Webhook event ${webhookEventId} already processed for order ${existingByWebhook.orderCode}`,
      )
      return { order: existingByWebhook, alreadyProcessed: true }
    }

    const paidAt = new Date()
    await this.orderRepo.update(
      { id: order.id },
      {
        status: BillingOrderStatus.PAID,
        paidAt,
        webhookEventId,
      },
    )

    const updated = await this.getById(order.id)
    return { order: updated, alreadyProcessed: false }
  }
}