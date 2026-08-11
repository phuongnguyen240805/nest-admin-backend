import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import {
  OrderBusinessStatus,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
} from '../common/enums'
import { deriveLifecycleFromLegacy } from '../common/order-lifecycle'
import { UpdateOrderLifecycleDto } from '../dto/order.dto'
import { OrderEntity } from '../entities/order.entity'
import { DomainEventOutboxService } from '../../domain-events/domain-event-outbox.service'

@Injectable()
export class OrderLifecycleService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    private readonly domainEvents: DomainEventOutboxService,
  ) {
    super(tenantContext)
  }

  initializeForCreate(input: {
    status: OrderStatus
    isIncomplete: boolean
    paymentMethod?: string | null
  }) {
    return deriveLifecycleFromLegacy(input)
  }

  async applyLegacyStatus(id: number, status: OrderStatus): Promise<OrderEntity> {
    const order = await this.requireOrder(id)
    order.status = status
    const lifecycle = deriveLifecycleFromLegacy({
      status,
      isIncomplete: order.isIncomplete,
      paymentMethod: order.paymentMethod,
    })
    order.businessStatus = lifecycle.businessStatus
    if (status === OrderStatus.UNPAID) order.paymentStatus = OrderPaymentStatus.PENDING
    if (status === OrderStatus.SHIPPED) order.fulfillmentStatus = OrderFulfillmentStatus.SHIPPED
    if (status === OrderStatus.COMPLETED) {
      order.businessStatus = OrderBusinessStatus.COMPLETED
      order.completedAt = order.completedAt ?? new Date()
      order.isIncomplete = false
    }
    if (status === OrderStatus.SPAM) order.businessStatus = OrderBusinessStatus.SPAM
    const saved = await this.orders.save(order)
    await this.emitStatusChanged(saved)
    return saved
  }

  async update(id: number, dto: UpdateOrderLifecycleDto): Promise<OrderEntity> {
    const order = await this.requireOrder(id)
    if (dto.businessStatus) {
      order.businessStatus = dto.businessStatus
      if (dto.businessStatus === OrderBusinessStatus.CONFIRMED) {
        order.confirmedAt = order.confirmedAt ?? new Date()
      }
      if (dto.businessStatus === OrderBusinessStatus.COMPLETED) {
        order.completedAt = order.completedAt ?? new Date()
        order.isIncomplete = false
        order.status = OrderStatus.COMPLETED
      }
      if (dto.businessStatus === OrderBusinessStatus.CANCELLED) {
        order.cancelledAt = order.cancelledAt ?? new Date()
        order.cancelReason = dto.cancelReason?.trim() || order.cancelReason
      }
      if (dto.businessStatus === OrderBusinessStatus.SPAM) order.status = OrderStatus.SPAM
    }
    if (dto.paymentStatus) this.applyPaymentStatus(order, dto.paymentStatus)
    if (dto.fulfillmentStatus) {
      order.fulfillmentStatus = dto.fulfillmentStatus
      if (this.isLegacyShipped(dto.fulfillmentStatus) && ![OrderStatus.COMPLETED, OrderStatus.SPAM].includes(order.status)) {
        order.status = OrderStatus.SHIPPED
      }
    }
    const saved = await this.orders.save(order)
    await this.emitStatusChanged(saved)
    return saved
  }

  async cancel(id: number, reason: string, manager?: EntityManager): Promise<OrderEntity> {
    const order = await this.requireOrder(id, manager)
    const repo = manager ? manager.getRepository(OrderEntity) : this.orders
    if (order.businessStatus === OrderBusinessStatus.CANCELLED) return order
    if ([OrderBusinessStatus.COMPLETED, OrderBusinessStatus.SPAM].includes(order.businessStatus)) {
      throw new BadRequestException(`Order cannot be cancelled from business status ${order.businessStatus}`)
    }
    if ([
      OrderFulfillmentStatus.SHIPPED,
      OrderFulfillmentStatus.IN_TRANSIT,
      OrderFulfillmentStatus.DELIVERING,
      OrderFulfillmentStatus.DELIVERED,
      OrderFulfillmentStatus.RETURNING,
      OrderFulfillmentStatus.RETURNED,
    ].includes(order.fulfillmentStatus)) {
      throw new BadRequestException(`Order cannot be cancelled from fulfillment status ${order.fulfillmentStatus}`)
    }

    order.businessStatus = OrderBusinessStatus.CANCELLED
    order.cancelledAt = order.cancelledAt ?? new Date()
    order.cancelReason = reason.trim().slice(0, 500) || 'Cancelled by agent approval'
    order.isIncomplete = false
    if ([OrderFulfillmentStatus.UNKNOWN, OrderFulfillmentStatus.UNFULFILLED, OrderFulfillmentStatus.READY_TO_SHIP].includes(order.fulfillmentStatus)) {
      order.fulfillmentStatus = OrderFulfillmentStatus.CANCELLED
    }
    const saved = await repo.save(order)
    await this.emitStatusChanged(saved, manager)
    await this.domainEvents.append({
      tenantId: saved.tenantId,
      aggregateType: 'order',
      aggregateId: saved.id,
      eventType: 'order.cancelled',
      payload: { orderId: saved.id, orderCode: saved.code, reason: saved.cancelReason },
    }, manager)
    return saved
  }

  async setPaymentStatus(
    id: number,
    status: OrderPaymentStatus,
    manager?: EntityManager,
  ): Promise<OrderEntity> {
    return this.setPaymentStatusForTenant(
      id,
      this.requireTenantId(),
      status,
      manager,
    )
  }

  /**
   * Trusted integration path for server-side callbacks that do not carry a
   * user TenantGuard context. Callers must derive tenantId from a tenant-owned
   * database record, never from an external webhook payload.
   */
  async setPaymentStatusForTenant(
    id: number,
    tenantId: number,
    status: OrderPaymentStatus,
    manager?: EntityManager,
  ): Promise<OrderEntity> {
    const repo = manager ? manager.getRepository(OrderEntity) : this.orders
    const order = await repo.findOne({ where: { id, tenantId } })
    if (!order) throw new NotFoundException('Order not found for payment tenant')
    this.applyPaymentStatus(order, status)
    const saved = await repo.save(order)
    await this.emitStatusChanged(saved, manager, 'payment')
    return saved
  }

  async setFulfillmentStatus(
    id: number,
    status: OrderFulfillmentStatus,
    manager?: EntityManager,
  ): Promise<OrderEntity> {
    const order = await this.requireOrder(id, manager)
    const repo = manager ? manager.getRepository(OrderEntity) : this.orders
    order.fulfillmentStatus = status
    if (this.isLegacyShipped(status) && ![OrderStatus.COMPLETED, OrderStatus.SPAM].includes(order.status)) {
      order.status = OrderStatus.SHIPPED
    }
    const saved = await repo.save(order)
    await this.emitStatusChanged(saved, manager, 'fulfillment')
    return saved
  }

  private async emitStatusChanged(
    order: OrderEntity,
    manager?: EntityManager,
    changedAxis?: 'payment' | 'fulfillment',
  ) {
    await this.domainEvents.append({
      tenantId: order.tenantId,
      aggregateType: 'order',
      aggregateId: order.id,
      eventType: 'order.status.changed',
      payload: {
        orderId: order.id,
        orderCode: order.code,
        status: order.status,
        businessStatus: order.businessStatus,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        changedAxis: changedAxis ?? 'business',
      },
    }, manager)
  }

  private applyPaymentStatus(order: OrderEntity, status: OrderPaymentStatus) {
    order.paymentStatus = status
    if ([OrderPaymentStatus.PENDING, OrderPaymentStatus.FAILED, OrderPaymentStatus.EXPIRED].includes(status)
      && ![OrderStatus.SHIPPED, OrderStatus.COMPLETED, OrderStatus.SPAM].includes(order.status)) {
      order.status = OrderStatus.UNPAID
    }
    if ([OrderPaymentStatus.PAID, OrderPaymentStatus.COD_PENDING, OrderPaymentStatus.NOT_REQUIRED].includes(status)
      && order.status === OrderStatus.UNPAID) {
      order.status = OrderStatus.PENDING
    }
  }

  private async requireOrder(id: number, manager?: EntityManager): Promise<OrderEntity> {
    const repo = manager ? manager.getRepository(OrderEntity) : this.orders
    return this.findOneForTenantOrFail(repo, { id }, 'Order not found')
  }

  private isLegacyShipped(status: OrderFulfillmentStatus): boolean {
    return [
      OrderFulfillmentStatus.SHIPPED,
      OrderFulfillmentStatus.IN_TRANSIT,
      OrderFulfillmentStatus.DELIVERING,
      OrderFulfillmentStatus.DELIVERED,
      OrderFulfillmentStatus.DELIVERY_FAILED,
      OrderFulfillmentStatus.RETURNING,
      OrderFulfillmentStatus.RETURNED,
    ].includes(status)
  }
}
