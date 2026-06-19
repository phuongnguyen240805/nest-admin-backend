import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import {
  CreateDeliveryNoteDto,
  DeliveryNoteQueryDto,
  UpdateDeliveryNoteDto,
} from '../dto/delivery-note.dto'
import { DeliveryNoteEntity, OrderEntity } from '../entities'

@Injectable()
export class DeliveryNoteService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(DeliveryNoteEntity)
    private readonly deliveryNoteRepository: Repository<DeliveryNoteEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: DeliveryNoteQueryDto): Promise<Pagination<DeliveryNoteEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.deliveryNoteRepository
      .createQueryBuilder('note')
      .where('note.tenantId = :tenantId', { tenantId })

    if (dto.orderId) {
      qb.andWhere('note.orderId = :orderId', { orderId: dto.orderId })
    }

    qb.orderBy('note.createdAt', 'DESC')
    return paginate(qb, { page: dto.page, pageSize: dto.pageSize })
  }

  async detail(id: number) {
    return this.findOneForTenantOrFail(
      this.deliveryNoteRepository,
      { id },
      'Delivery note not found',
    )
  }

  async create(dto: CreateDeliveryNoteDto) {
    await this.findOneForTenantOrFail(
      this.orderRepository,
      { id: dto.orderId },
      'Order not found',
    )

    return this.deliveryNoteRepository.save({
      tenantId: this.requireTenantId(),
      orderId: dto.orderId,
      content: dto.content ?? null,
      status: dto.status ?? 'DRAFT',
      shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : null,
    })
  }

  async update(id: number, dto: UpdateDeliveryNoteDto) {
    const note = await this.detail(id)
    Object.assign(note, {
      orderId: dto.orderId ?? note.orderId,
      content: dto.content !== undefined ? dto.content : note.content,
      status: dto.status ?? note.status,
      shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : note.shippedAt,
    })
    return this.deliveryNoteRepository.save(note)
  }

  async remove(id: number) {
    const note = await this.detail(id)
    await this.deliveryNoteRepository.remove(note)
  }
}