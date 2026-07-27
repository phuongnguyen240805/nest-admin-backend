import { Injectable } from '@nestjs/common'

import type { CommerceOrderDto } from '../types/commerce.types'
import { commerceMemoryStore } from './commerce-memory.store'
import { CommerceStoreService } from './commerce-store.service'

@Injectable()
export class CommerceOrderService {
  constructor(private readonly storeService: CommerceStoreService) {}

  async list(organizationId: string): Promise<CommerceOrderDto[]> {
    await this.storeService.ensureStore(organizationId)
    return commerceMemoryStore.listOrders(organizationId)
  }
}
