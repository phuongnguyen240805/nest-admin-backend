import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { OrderPaymentStatus } from '../../ecom-store/common/enums'
import { OrderEntity } from '../../ecom-store/entities/order.entity'
import { OrderLifecycleService } from '../../ecom-store/services/order-lifecycle.service'
import { CreateOrderPaymentDto } from '../dto/order-payment.dto'
import { OrderPaymentEntity, OrderPaymentEventEntity } from '../entities'
import { SepayQrProvider } from '../providers/sepay/sepay-qr.provider'

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly tenantContext: TenantContextService,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderPaymentEntity)
    private readonly payments: Repository<OrderPaymentEntity>,
    @InjectRepository(OrderPaymentEventEntity)
    private readonly paymentEvents: Repository<OrderPaymentEventEntity>,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly sepayQr: SepayQrProvider,
    private readonly dataSource: DataSource,
  ) {}

  async list(orderId: number) {
    const tenantId = this.requireTenantId()
    await this.requireOrder(orderId, tenantId)
    const rows = await this.payments.find({
      where: { tenantId, orderId },
      order: { createdAt: 'DESC' },
    })
    return rows.map((row) => this.toResponse(row))
  }

  async get(orderId: number, paymentId: number) {
    const tenantId = this.requireTenantId()
    await this.requireOrder(orderId, tenantId)
    const payment = await this.payments.findOne({
      where: { id: paymentId, tenantId, orderId },
    })
    if (!payment) throw new NotFoundException('Order payment not found')
    return this.toResponse(payment)
  }

  async events(orderId: number, paymentId: number) {
    const tenantId = this.requireTenantId()
    await this.get(orderId, paymentId)
    return this.paymentEvents.find({
      where: { tenantId, paymentId },
      order: { createdAt: 'ASC' },
    })
  }

  async createSepay(orderId: number, dto: CreateOrderPaymentDto) {
    return this.create(orderId, dto, 'sepay')
  }

  async createCod(orderId: number, dto: CreateOrderPaymentDto) {
    return this.create(orderId, dto, 'cod')
  }

  private async create(orderId: number, dto: CreateOrderPaymentDto, provider: 'sepay' | 'cod') {
    const tenantId = this.requireTenantId()
    const idempotencyKey = dto.idempotencyKey?.trim() || null

    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(OrderPaymentEntity)
      const eventRepo = manager.getRepository(OrderPaymentEventEntity)

      // Serialize payment creation for one order to avoid duplicate pending
      // payments when callers retry concurrently without an idempotency key.
      await manager.query(
        'SELECT pg_advisory_xact_lock($1::int, $2::int)',
        [tenantId, -orderId],
      )

      const order = await manager.getRepository(OrderEntity).findOne({
        where: { id: orderId, tenantId },
      })
      if (!order) throw new NotFoundException('Order not found')

      if (idempotencyKey) {
        const retried = await paymentRepo.findOne({ where: { tenantId, idempotencyKey } })
        if (retried) {
          if (retried.orderId !== orderId || retried.provider !== provider) {
            throw new BadRequestException('Payment idempotency key is already used for another payment')
          }
          return this.toResponse(retried)
        }
      }

      const activeStatus = provider === 'cod'
        ? OrderPaymentStatus.COD_PENDING
        : OrderPaymentStatus.PENDING
      const active = await paymentRepo.findOne({
        where: { tenantId, orderId, provider, status: activeStatus },
        order: { createdAt: 'DESC' },
      })
      if (active) return this.toResponse(active)

      let payment = await paymentRepo.save({
        tenantId,
        orderId,
        provider,
        method: provider === 'cod' ? 'cod' : 'bank_transfer_qr',
        status: activeStatus,
        amount: Number(order.total),
        currency: 'VND',
        referenceCode: null,
        providerTransactionId: null,
        idempotencyKey,
        qrUrl: null,
        paidAt: null,
        expiredAt: null,
        cancelledAt: null,
        metadata: {},
      })

      if (provider === 'sepay') {
        payment.referenceCode = `LIO${tenantId}P${payment.id}`
        const prepared = this.sepayQr.createPayment({
          referenceCode: payment.referenceCode,
          amount: Number(payment.amount),
        })
        payment.qrUrl = prepared.qrUrl ?? null
        payment.metadata = prepared.metadata ?? {}
        payment = await paymentRepo.save(payment)
      }

      await eventRepo.save({
        tenantId,
        paymentId: payment.id,
        type: 'payment.created',
        status: payment.status,
        providerEventId: null,
        payload: { provider, orderId },
      })
      await this.orderLifecycle.setPaymentStatus(orderId, activeStatus, manager)
      return this.toResponse(payment)
    })
  }

  async markPaid(
    payment: OrderPaymentEntity,
    input: { providerEventId: string; providerTransactionId?: string | null; paidAt: Date; payload: Record<string, unknown> },
    manager: EntityManager,
  ): Promise<OrderPaymentEntity> {
    const paymentRepo = manager.getRepository(OrderPaymentEntity)
    const eventRepo = manager.getRepository(OrderPaymentEventEntity)
    if (payment.status === OrderPaymentStatus.PAID) return payment

    payment.status = OrderPaymentStatus.PAID
    payment.providerTransactionId = input.providerTransactionId || payment.providerTransactionId
    payment.paidAt = input.paidAt
    const saved = await paymentRepo.save(payment)
    await eventRepo.save({
      tenantId: payment.tenantId,
      paymentId: payment.id,
      type: 'payment.paid',
      status: OrderPaymentStatus.PAID,
      providerEventId: input.providerEventId,
      payload: input.payload,
    })
    await this.orderLifecycle.setPaymentStatusForTenant(
      payment.orderId,
      payment.tenantId,
      OrderPaymentStatus.PAID,
      manager,
    )
    return saved
  }

  private requireTenantId(): number {
    const tenantId = this.tenantContext.getTenantId()
    if (!tenantId) throw new BadRequestException('Tenant context is required')
    return tenantId
  }

  private async requireOrder(orderId: number, tenantId: number): Promise<OrderEntity> {
    const order = await this.orders.findOne({ where: { id: orderId, tenantId } })
    if (!order) throw new NotFoundException('Order not found')
    return order
  }

  toResponse(row: OrderPaymentEntity) {
    return {
      ...row,
      amount: Number(row.amount),
    }
  }
}
