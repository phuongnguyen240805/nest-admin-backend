import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { CustomerCareConversationLinkEntity, CustomerCareConversationOrderLinkEntity } from '../customer-care/customer-care.entities'
import { DomainOutboxEventEntity } from '../domain-events/entities/domain-outbox-event.entity'

export interface CustomerCaseTimelineItem {
  eventId: string
  type: string
  occurredAt: string
  aggregateType: string
  subjectId: string
  summary: string
  payload: Record<string, unknown>
}

@Injectable()
export class CustomerCaseTimelineService {
  constructor(
    private readonly tenantContext: TenantContextService,
    @InjectRepository(CustomerCareConversationLinkEntity)
    private readonly conversations: Repository<CustomerCareConversationLinkEntity>,
    @InjectRepository(CustomerCareConversationOrderLinkEntity)
    private readonly conversationOrders: Repository<CustomerCareConversationOrderLinkEntity>,
    @InjectRepository(DomainOutboxEventEntity)
    private readonly events: Repository<DomainOutboxEventEntity>,
  ) {}

  async getTimeline(conversationId: string, limit = 200): Promise<CustomerCaseTimelineItem[]> {
    const tenantId = this.requireTenantId()
    const conversation = await this.conversations.findOne({
      where: { tenantId, libreDeskConversationUuid: conversationId },
    })
    if (!conversation || conversation.metadata?.deletedAt) {
      throw new NotFoundException('Customer Care conversation not found')
    }

    const links = await this.conversationOrders.find({
      where: { tenantId, conversationLinkId: conversation.id },
    })
    const orderIds = links.map((row) => String(row.orderId))

    const qb = this.events
      .createQueryBuilder('event')
      .where('event.tenantId = :tenantId', { tenantId })
      .andWhere(new Brackets((where) => {
        where.where(
          '(event.aggregateType = :conversationType AND event.aggregateId = :conversationId)',
          { conversationType: 'conversation', conversationId },
        )
        if (orderIds.length) {
          where.orWhere(
            '(event.aggregateType = :orderType AND event.aggregateId IN (:...orderIds))',
            { orderType: 'order', orderIds },
          )
          where.orWhere(
            `(event.payload ->> 'orderId') IN (:...orderIds)`,
            { orderIds },
          )
        }
      }))
      .orderBy('event.createdAt', 'ASC')
      .take(Math.min(Math.max(limit, 1), 500))

    const rows = await qb.getMany()
    return rows.map((row) => ({
      eventId: row.eventId,
      type: row.eventType,
      occurredAt: row.createdAt.toISOString(),
      aggregateType: row.aggregateType,
      subjectId: row.aggregateId,
      summary: this.summarize(row.eventType, row.payload),
      payload: row.payload,
    }))
  }

  private summarize(eventType: string, payload: Record<string, unknown>): string {
    const code = typeof payload.orderCode === 'string' ? ` ${payload.orderCode}` : ''
    const status = typeof payload.status === 'string' ? ` → ${payload.status}` : ''
    const message = payload.message && typeof payload.message === 'object'
      ? payload.message as Record<string, unknown>
      : undefined
    const rawContent = typeof payload.content === 'string'
      ? payload.content
      : typeof message?.content === 'string'
        ? message.content
        : ''
    const content = rawContent.trim().slice(0, 180)
    switch (eventType) {
      case 'order.created': return `Đơn hàng${code} được tạo`
      case 'order.status.changed': return `Trạng thái đơn hàng${code}${status}`
      case 'payment.created': return `Thanh toán cho đơn hàng${code} được tạo`
      case 'payment.paid': return `Thanh toán cho đơn hàng${code} đã thành công`
      case 'payment.status.changed': return `Trạng thái thanh toán${status}`
      case 'shipment.created': return `Vận đơn cho đơn hàng${code} được tạo`
      case 'shipment.status.changed': return `Trạng thái vận chuyển${status}`
      case 'shipment.delivered': return `Đơn hàng${code} đã giao thành công`
      case 'conversation-order.linked': return `Liên kết hội thoại với đơn hàng${code}`
      case 'customer-care.message.inbound': return content ? `Khách: ${content}` : 'Khách gửi tin nhắn'
      case 'customer-care.message.outbound': return content ? `CSKH: ${content}` : 'CSKH gửi tin nhắn'
      default: return eventType
    }
  }

  private requireTenantId(): number {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null) throw new ForbiddenException('Tenant ID is required')
    return tenantId
  }
}
