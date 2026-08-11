import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { TenantContextService } from '@liora/nest-core'

import { CustomerCareService } from '../../customer-care/customer-care.service'
import type { CustomerCareAiToolContext } from './customer-care-ai-tool.types'

@Injectable()
export class CustomerCareAiToolGuardService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly customerCare: CustomerCareService,
  ) {}

  assertContext(context: CustomerCareAiToolContext) {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null || tenantId !== context.tenantId) {
      throw new ForbiddenException('AI tool tenant context mismatch')
    }
    if (!context.conversationId) throw new BadRequestException('conversationId is required')
  }

  async linkedOrders(context: CustomerCareAiToolContext): Promise<any[]> {
    this.assertContext(context)
    return this.customerCare.conversationOrders(context.conversationId) as Promise<any[]>
  }

  async requireLinkedOrder(context: CustomerCareAiToolContext, orderId: number): Promise<any> {
    if (!Number.isInteger(orderId) || orderId <= 0) throw new BadRequestException('orderId must be a positive integer')
    const orders = await this.linkedOrders(context)
    const order = orders.find((row: any) => Number(row.id ?? row.orderId) === orderId)
    if (!order) throw new NotFoundException('Order is not linked to this conversation')
    return order
  }
}
