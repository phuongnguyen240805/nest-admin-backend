import { Injectable } from '@nestjs/common'

import type { CommerceOrderDto } from '../types/commerce.types'
import { commerceMemoryStore } from './commerce-memory.store'
import { CommerceStoreService } from './commerce-store.service'

@Injectable()
export class CommerceOrderService {
  constructor(private readonly storeService: CommerceStoreService) {}

  list(organizationId: string): CommerceOrderDto[] {
    this.storeService.ensureStore(organizationId)
    return commerceMemoryStore.listOrders(organizationId)
  }
}
