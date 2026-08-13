import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, In, Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { OrderCustomerResolver } from './order-customer.resolver'
import { OrderLifecycleService } from './order-lifecycle.service'
import { DomainEventOutboxService } from '../../domain-events/domain-event-outbox.service'

import { OrderStatus } from '../common/enums'
import {
  CreateOrderDto,
  OrderQueryDto,
  UpdateOrderLifecycleDto,
  UpdateOrderStatusDto,
} from '../dto/order.dto'
import {
  OrderEntity,
  OrderItemEntity,
  OrderTagEntity,
  OrderTagMapEntity,
  ShipmentEntity,
} from '../entities'

const INCOMPLETE_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.UNPAID,
  OrderStatus.SHIPPED,
]

@Injectable()
export class OrderService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(OrderTagMapEntity)
    private readonly orderTagMapRepository: Repository<OrderTagMapEntity>,
    @InjectRepository(OrderTagEntity)
    private readonly orderTagRepository: Repository<OrderTagEntity>,
    @InjectRepository(ShipmentEntity)
    private readonly shipmentRepository: Repository<ShipmentEntity>,
    private readonly orderCustomerResolver: OrderCustomerResolver,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly domainEvents: DomainEventOutboxService,
    private readonly dataSource: DataSource,
  ) {
    super(tenantContext)
  }

  async list(dto: OrderQueryDto): Promise<Pagination<Record<string, unknown>>> {
    const tenantId = this.requireTenantId()
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .where('order.tenantId = :tenantId', { tenantId })

    if (dto.status === 'incomplete') {
      qb.andWhere(
        '(order.isIncomplete = true OR order.status IN (:...statuses))',
        { statuses: INCOMPLETE_STATUSES },
      )
    } else if (dto.status) {
      qb.andWhere('order.status = :status', { status: dto.status })
    }

    qb.orderBy('order.createdAt', 'DESC')
    const result = await paginate(qb, { page: dto.page, pageSize: dto.pageSize })
    const items = await Promise.all(result.items.map((o) => this.toListItem(o)))
    return new Pagination(items, result.meta)
  }

  async detail(id: number, manager?: EntityManager) {
    const orderRepository = manager
      ? manager.getRepository(OrderEntity)
      : this.orderRepository
    const orderItemRepository = manager
      ? manager.getRepository(OrderItemEntity)
      : this.orderItemRepository
    const orderTagMapRepository = manager
      ? manager.getRepository(OrderTagMapEntity)
      : this.orderTagMapRepository
    const orderTagRepository = manager
      ? manager.getRepository(OrderTagEntity)
      : this.orderTagRepository

    const order = await this.findOneForTenantOrFail(
      orderRepository,
      { id },
      'Order not found',
    )
    const items = await orderItemRepository.find({ where: { orderId: id } })
    const tagMaps = await orderTagMapRepository.find({ where: { orderId: id } })
    const tags = tagMaps.length
      ? await orderTagRepository.find({
          where: {
            id: In(tagMaps.map((m) => m.tagId)),
            tenantId: this.requireTenantId(),
          },
        })
      : []
    const shipment = await (manager
      ? manager.getRepository(ShipmentEntity)
      : this.shipmentRepository
    ).findOne({ where: { tenantId: this.requireTenantId(), orderId: id } })

    return {
      ...order,
      items,
      tags: tags.map((t) => t.name),
      shipment: shipment
        ? {
            ...shipment,
            fee: Number(shipment.fee),
            codAmount: Number(shipment.codAmount),
          }
        : null,
    }
  }

  async create(dto: CreateOrderDto, manager?: EntityManager) {
    const tenantId = this.requireTenantId()
    const customer = await this.orderCustomerResolver.resolve({
      name: dto.customerName,
      phone: dto.customerPhone,
      email: dto.customerEmail ?? null,
    })

    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    )
    const shippingFee = dto.shippingFee ?? 0
    const total = subtotal + shippingFee

    const createWithManager = async (tx: EntityManager) => {
      const orderRepo = tx.getRepository(OrderEntity)
      const itemRepo = tx.getRepository(OrderItemEntity)
      const tagMapRepo = tx.getRepository(OrderTagMapEntity)

      const legacyStatus = dto.status ?? OrderStatus.PENDING
      const isIncomplete = dto.isIncomplete ?? false
      const lifecycle = this.orderLifecycle.initializeForCreate({
        status: legacyStatus,
        isIncomplete,
        paymentMethod: dto.paymentMethod ?? null,
      })
      const now = new Date()
      const order = await orderRepo.save({
        tenantId,
        code: await this.generateOrderCode(orderRepo, tenantId),
        customerId: customer.customerId,
        personId: customer.personId,
        status: legacyStatus,
        businessStatus: lifecycle.businessStatus,
        paymentStatus: lifecycle.paymentStatus,
        fulfillmentStatus: lifecycle.fulfillmentStatus,
        confirmedAt: lifecycle.businessStatus === 'CONFIRMED' ? now : null,
        completedAt: lifecycle.businessStatus === 'COMPLETED' ? now : null,
        cancelledAt: null,
        cancelReason: null,
        total,
        subtotal,
        shippingFee,
        discount: 0,
        shippingPayer: 'customer',
        shippingQuoteId: null,
        paymentMethod: dto.paymentMethod ?? null,
        source: dto.source ?? null,
        assigneeId: dto.assigneeId ?? null,
        assigneeName: dto.assigneeName ?? null,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail ?? null,
        notes: dto.notes ?? null,
        isIncomplete,
      })

      await itemRepo.save(
        dto.items.map((item) => ({
          orderId: order.id,
          productId: item.productId ?? null,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
        })),
      )

      if (dto.tagIds?.length) {
        await tagMapRepo.save(
          dto.tagIds.map((tagId) => ({ orderId: order.id, tagId })),
        )
      }

      await this.domainEvents.append({
        tenantId,
        aggregateType: 'order',
        aggregateId: order.id,
        eventType: 'order.created',
        payload: {
          orderId: order.id,
          orderCode: order.code,
          businessStatus: order.businessStatus,
          paymentStatus: order.paymentStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          source: order.source,
        },
      }, tx)

      return this.detail(order.id, tx)
    }

    return manager
      ? createWithManager(manager)
      : this.dataSource.transaction(createWithManager)
  }

  async updateStatus(id: number, dto: UpdateOrderStatusDto) {
    await this.orderLifecycle.applyLegacyStatus(id, dto.status)
    return this.detail(id)
  }

  async updateLifecycle(id: number, dto: UpdateOrderLifecycleDto) {
    await this.orderLifecycle.update(id, dto)
    return this.detail(id)
  }

  private async toListItem(order: OrderEntity) {
    const items = await this.orderItemRepository.find({
      where: { orderId: order.id },
    })
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0)
    const productName = items
      .map((item) => `${item.productName} (x${item.quantity})`)
      .join(', ')

    return {
      id: order.code,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail ?? undefined,
      productName,
      quantity,
      totalPrice: Number(order.total),
      status: order.status,
      businessStatus: order.businessStatus,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      createdAt: order.createdAt,
      orderId: order.id,
      customerId: order.customerId,
      personId: order.personId,
      source: order.source ?? undefined,
      assigneeId: order.assigneeId ?? undefined,
      assigneeName: order.assigneeName ?? undefined,
      isIncomplete: order.isIncomplete,
    }
  }

  private async generateOrderCode(
    repo: Repository<OrderEntity>,
    tenantId: number,
  ): Promise<string> {
    // Order creation already runs inside a transaction. Serialize code allocation
    // per tenant so concurrent creates cannot allocate the same DHxxxx code.
    await repo.manager.query(
      'SELECT pg_advisory_xact_lock($1::int, $2::int)',
      [tenantId, 7301],
    )
    const rows = await repo.manager.query(
      `SELECT COALESCE(MAX(
        CASE WHEN "code" ~ '^DH[0-9]+$'
          THEN substring("code" from 3)::int
          ELSE NULL
        END
      ), 1000) AS "maxCode"
      FROM "lp_order"
      WHERE "tenantId" = $1`,
      [tenantId],
    )
    return `DH${Number(rows?.[0]?.maxCode ?? 1000) + 1}`
  }
}
