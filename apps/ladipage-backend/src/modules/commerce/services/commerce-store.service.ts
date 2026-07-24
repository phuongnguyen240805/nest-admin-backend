import { Injectable } from '@nestjs/common'

import { getCommerceConfig } from '../commerce.config'
import {
  MedusaHttpClient,
  resolveMedusaBaseUrlCandidates,
} from '../clients/medusa-http.client'
import type {
  CommerceHealthDto,
  CommerceStoreLinkDto,
  StorefrontSessionDto,
} from '../types/commerce.types'
import { commerceMemoryStore } from './commerce-memory.store'

@Injectable()
export class CommerceStoreService {
  async health(): Promise<CommerceHealthDto> {
    const cfg = getCommerceConfig()
    if (!cfg.enabled) {
      return {
        enabled: false,
        mockMode: cfg.mockMode,
        monetize: cfg.monetize,
        medusaBaseUrl: cfg.medusaBaseUrl,
        medusaReachable: false,
        message: 'Commerce disabled',
      }
    }

    if (cfg.mockMode) {
      return {
        enabled: true,
        mockMode: true,
        monetize: cfg.monetize,
        medusaBaseUrl: cfg.medusaBaseUrl,
        medusaReachable: false,
        message:
          'MOCK MODE: products NOT written to Medusa Admin. '
          + 'Set COMMERCE_MEDUSA_MOCK=false + MEDUSA_ADMIN_API_KEY to write live.',
      }
    }

    const admin = MedusaHttpClient.fromConfig('admin')
    const storePing = await admin.get('/admin/products?limit=1')
    const adminOk = storePing.ok

    return {
      enabled: true,
      mockMode: false,
      monetize: cfg.monetize,
      medusaBaseUrl: cfg.medusaBaseUrl,
      medusaReachable: adminOk,
      message: adminOk
        ? `LIVE: Medusa Admin reachable via ${storePing.baseUrlUsed ?? cfg.medusaBaseUrl}`
        : `LIVE config but Medusa unreachable at ${cfg.medusaBaseUrl}. Tried: ${resolveMedusaBaseUrlCandidates(cfg.medusaBaseUrl).join(', ')}. `
          + 'Browser localhost != Nest process network (WSL/Docker). '
          + 'Set MEDUSA_BACKEND_URL to Windows host IP from WSL (nameserver in /etc/resolv.conf) '
          + `and ensure Medusa listens 0.0.0.0:9000. Error: ${storePing.error ?? 'unknown'}`,
      lastError: storePing.error,
      lastStatus: storePing.status,
      baseUrlUsed: storePing.baseUrlUsed,
      candidatesTried: resolveMedusaBaseUrlCandidates(cfg.medusaBaseUrl),
    }
  }

  getStore(organizationId: string): CommerceStoreLinkDto | null {
    return commerceMemoryStore.getLink(organizationId)
  }

  ensureStore(organizationId: string): CommerceStoreLinkDto {
    const existing = commerceMemoryStore.getLink(organizationId)
    if (existing) return existing

    const cfg = getCommerceConfig()
    const link = commerceMemoryStore.ensureLink(organizationId, {
      regionId: cfg.defaultRegionId,
      currencyCode: cfg.defaultCurrency,
      publishableKey: cfg.publishableKey,
    })

    if (!cfg.mockMode) {
      const liveLink: CommerceStoreLinkDto = {
        ...link,
        healthMessage: 'Live Medusa bridge link',
        publishableKeyPreview: cfg.publishableKey
          ? `${cfg.publishableKey.slice(0, 8)}...`
          : undefined,
      }
      commerceMemoryStore.setLink(organizationId, liveLink)
      return liveLink
    }

    return link
  }

  createStorefrontSession(
    organizationId: string,
    pageId?: string,
  ): StorefrontSessionDto {
    const cfg = getCommerceConfig()
    const link = this.ensureStore(organizationId)

    return {
      mockMode: cfg.mockMode,
      medusaBaseUrl: cfg.medusaBaseUrl,
      publishableKey: cfg.publishableKey,
      salesChannelId: link.salesChannelId,
      regionId: link.regionId,
      currencyCode: link.currencyCode,
      pageId,
    }
  }
}
