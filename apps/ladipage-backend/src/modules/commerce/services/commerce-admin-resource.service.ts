import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'

import { getCommerceConfig } from '../commerce.config'
import { MedusaHttpClient } from '../clients/medusa-http.client'

export type CommerceResourceKind =
  | 'categories'
  | 'product-tags'
  | 'customers'
  | 'promotions'

type ResourceRecord = Record<string, unknown> & { id: string }

const CONFIG: Record<
  CommerceResourceKind,
  { path: string; envelope: string; singular: string }
> = {
  categories: {
    path: '/admin/product-categories',
    envelope: 'product_categories',
    singular: 'product_category',
  },
  'product-tags': {
    path: '/admin/product-tags',
    envelope: 'product_tags',
    singular: 'product_tag',
  },
  customers: {
    path: '/admin/customers',
    envelope: 'customers',
    singular: 'customer',
  },
  promotions: {
    path: '/admin/promotions',
    envelope: 'promotions',
    singular: 'promotion',
  },
}

/**
 * Tenant-safe BFF for Medusa Admin resources used by the LadiPage UI.
 *
 * Every created record carries ladipage_organization_id in metadata. Lists
 * and mutations are filtered/verified again in Nest, because Admin API keys
 * themselves are not tenant scoped.
 */
@Injectable()
export class CommerceAdminResourceService {
  private readonly mock = new Map<string, ResourceRecord[]>()

  async list(kind: CommerceResourceKind, organizationId: string) {
    if (getCommerceConfig().mockMode) {
      return [...(this.mock.get(this.key(kind, organizationId)) ?? [])]
    }

    const cfg = CONFIG[kind]
    const result = await MedusaHttpClient.fromConfig('admin').get<
      Record<string, unknown>
    >(`${cfg.path}?limit=100`)
    this.assertOk(result.ok, result.error)
    const items = (result.data?.[cfg.envelope] ?? []) as ResourceRecord[]
    return items.filter(item => this.belongsTo(item, organizationId))
  }

  async create(
    kind: CommerceResourceKind,
    organizationId: string,
    input: Record<string, unknown>,
  ) {
    const payload = this.withTenantMetadata(input, organizationId)
    if (getCommerceConfig().mockMode) {
      const item = {
        ...payload,
        id: `${kind.replace(/\W/g, '_')}_${Date.now().toString(36)}`,
      } as ResourceRecord
      const key = this.key(kind, organizationId)
      this.mock.set(key, [item, ...(this.mock.get(key) ?? [])])
      return item
    }

    const cfg = CONFIG[kind]
    const result = await MedusaHttpClient.fromConfig('admin').post<
      Record<string, unknown>
    >(cfg.path, payload)
    this.assertOk(result.ok, result.error)
    return result.data?.[cfg.singular] as ResourceRecord
  }

  async update(
    kind: CommerceResourceKind,
    organizationId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    await this.requireOwned(kind, organizationId, id)
    const payload = this.withTenantMetadata(input, organizationId)
    if (getCommerceConfig().mockMode) {
      const key = this.key(kind, organizationId)
      let updated: ResourceRecord | undefined
      this.mock.set(
        key,
        (this.mock.get(key) ?? []).map((item) => {
          if (item.id !== id) return item
          updated = { ...item, ...payload }
          return updated
        }),
      )
      return updated
    }

    const cfg = CONFIG[kind]
    const result = await MedusaHttpClient.fromConfig('admin').post<
      Record<string, unknown>
    >(`${cfg.path}/${encodeURIComponent(id)}`, payload)
    this.assertOk(result.ok, result.error)
    return result.data?.[cfg.singular] as ResourceRecord
  }

  async remove(
    kind: CommerceResourceKind,
    organizationId: string,
    id: string,
  ) {
    await this.requireOwned(kind, organizationId, id)
    if (getCommerceConfig().mockMode) {
      const key = this.key(kind, organizationId)
      this.mock.set(
        key,
        (this.mock.get(key) ?? []).filter(item => item.id !== id),
      )
      return { id, deleted: true }
    }

    const cfg = CONFIG[kind]
    const result = await MedusaHttpClient.fromConfig('admin').delete(
      `${cfg.path}/${encodeURIComponent(id)}`,
    )
    this.assertOk(result.ok, result.error)
    return { id, deleted: true }
  }

  private async requireOwned(
    kind: CommerceResourceKind,
    organizationId: string,
    id: string,
  ) {
    const item = (await this.list(kind, organizationId)).find(
      candidate => candidate.id === id,
    )
    if (!item) throw new NotFoundException('Commerce resource not found')
    return item
  }

  private belongsTo(item: ResourceRecord, organizationId: string) {
    const metadata = item.metadata as Record<string, unknown> | undefined
    return metadata?.ladipage_organization_id === organizationId
  }

  private withTenantMetadata(
    input: Record<string, unknown>,
    organizationId: string,
  ) {
    return {
      ...input,
      metadata: {
        ...((input.metadata as Record<string, unknown> | undefined) ?? {}),
        ladipage_organization_id: organizationId,
      },
    }
  }

  private key(kind: CommerceResourceKind, organizationId: string) {
    return `${organizationId}:${kind}`
  }

  private assertOk(ok: boolean, error?: string) {
    if (!ok) {
      throw new InternalServerErrorException(
        error ?? 'Medusa Admin request failed',
      )
    }
  }
}
