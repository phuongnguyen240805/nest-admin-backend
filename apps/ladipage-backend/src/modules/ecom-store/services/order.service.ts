import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, In, Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { OrderCustomerResolver } from './order-customer.resolver'

import { OrderStatus } from '../common/enums'
import {
  CreateOrderDto,
  OrderQueryDto,
  UpdateOrderStatusDto,
} from '../dto/order.dto'
import {
  OrderEntity,
  OrderItemEntity,
  OrderTagEntity,
  OrderTagMapEntity,
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
    private readonly orderCustomerResolver: OrderCustomerResolver,
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

    return {
      ...order,
      items,
      tags: tags.map((t) => t.name),
    }
  }

  async create(dto: CreateOrderDto) {
    const tenantId = this.requireTenantId()
    const customer = await this.orderCustomerResolver.resolve({
      name: dto.customerName,
      phone: dto.customerPhone,
      email: dto.customerEmail ?? null,
    })

    const total = dto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    )

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(OrderEntity)
      const itemRepo = manager.getRepository(OrderItemEntity)
      const tagMapRepo = manager.getRepository(OrderTagMapEntity)

      const order = await orderRepo.save({
        tenantId,
        code: await this.generateOrderCode(orderRepo, tenantId),
        customerId: customer.customerId,
        personId: customer.personId,
        status: dto.status ?? OrderStatus.PENDING,
        total,
        paymentMethod: dto.paymentMethod ?? null,
        source: dto.source ?? null,
        assigneeId: dto.assigneeId ?? null,
        assigneeName: dto.assigneeName ?? null,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail ?? null,
        notes: dto.notes ?? null,
        isIncomplete: dto.isIncomplete ?? false,
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

      return this.detail(order.id, manager)
    })
  }

  async updateStatus(id: number, dto: UpdateOrderStatusDto) {
    const order = await this.findOneForTenantOrFail(
      this.orderRepository,
      { id },
      'Order not found',
    )
    order.status = dto.status
    if (dto.status === OrderStatus.COMPLETED) {
      order.isIncomplete = false
    }
    await this.orderRepository.save(order)
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
    const count = await repo.count({ where: { tenantId } })
    return `DH${1000 + count + 1}`
  }
}
