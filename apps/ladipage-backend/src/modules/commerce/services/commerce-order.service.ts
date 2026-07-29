import { Injectable, InternalServerErrorException } from '@nestjs/common'

import { getCommerceConfig } from '../commerce.config'
import { MedusaHttpClient } from '../clients/medusa-http.client'
import type { CommerceOrderDto } from '../types/commerce.types'
import { commerceMemoryStore } from './commerce-memory.store'
import { CommerceStoreService } from './commerce-store.service'

@Injectable()
export class CommerceOrderService {
  constructor(private readonly storeService: CommerceStoreService) {}

  async list(organizationId: string): Promise<CommerceOrderDto[]> {
    const link = await this.storeService.ensureStore(organizationId)
    if (getCommerceConfig().mockMode) {
      return commerceMemoryStore.listOrders(organizationId)
    }

    const result = await MedusaHttpClient.fromConfig('admin').get<{
      orders?: Array<Record<string, unknown>>
    }>(
      `/admin/orders?limit=100&sales_channel_id[]=${encodeURIComponent(link.salesChannelId)}`,
    )
    if (!result.ok) {
      throw new InternalServerErrorException(
        result.error ?? 'Unable to list Medusa orders',
      )
    }

    return (result.data?.orders ?? [])
      .filter((order) => {
        const channel = order.sales_channel as { id?: string } | undefined
        return (
          order.sales_channel_id === link.salesChannelId
          || channel?.id === link.salesChannelId
        )
      })
      .map((order) => {
        const metadata = (order.metadata ?? {}) as Record<string, unknown>
        const items = (order.items ?? []) as Array<Record<string, unknown>>
        const firstName = String(order.shipping_address
          ? (order.shipping_address as Record<string, unknown>).first_name ?? ''
          : '')
        const lastName = String(order.shipping_address
          ? (order.shipping_address as Record<string, unknown>).last_name ?? ''
          : '')
        return {
          id: String(order.id),
          displayId: `#${String(order.display_id ?? order.id)}`,
          email: String(order.email ?? ''),
          customerName:
            `${firstName} ${lastName}`.trim() || String(order.email ?? ''),
          total: Number(order.total ?? 0),
          currencyCode: String(order.currency_code ?? link.currencyCode),
          status: String(order.status ?? 'pending'),
          landingPageId: metadata.ladipage_page_id
            ? String(metadata.ladipage_page_id)
            : null,
          landingPageName: metadata.ladipage_page_name
            ? String(metadata.ladipage_page_name)
            : null,
          itemsSummary: items
            .map(item => `${String(item.title ?? 'Product')} × ${Number(item.quantity ?? 0)}`)
            .join(', '),
          createdAt: String(order.created_at ?? new Date().toISOString()),
        }
      })
  }
}
