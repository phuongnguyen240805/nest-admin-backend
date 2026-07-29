import { Injectable, Logger } from '@nestjs/common'

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
import type { CommerceStoreLinkEntity } from '../entities'
import { CommerceStoreLinkService } from './commerce-store-link.service'
import { MedusaProvisioningService } from './medusa-provisioning.service'

@Injectable()
export class CommerceStoreService {
  private readonly logger = new Logger(CommerceStoreService.name)

  constructor(
    private readonly links: CommerceStoreLinkService,
    private readonly provisioning: MedusaProvisioningService,
  ) {}

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

  async getStore(organizationId: string): Promise<CommerceStoreLinkDto | null> {
    const entity = await this.links.findByOrg(organizationId)
    return entity ? this.toDto(entity) : null
  }

  /**
   * Returns the org's store link, provisioning it on first use.
   * In live mode this creates a real Medusa sales channel + publishable key
   * (idempotent) so that catalog isolation is enforced by a channel that
   * actually exists — not a fabricated local id.
   */
  async ensureStore(organizationId: string): Promise<CommerceStoreLinkDto> {
    const existing = await this.links.findByOrg(organizationId)
    if (existing && existing.status === 'active' && existing.salesChannelId) {
      return this.toDto(existing)
    }

    const cfg = getCommerceConfig()

    if (cfg.mockMode) {
      const link = await this.links.upsert(organizationId, {
        mode: 'hosted_shared',
        salesChannelId:
          existing?.salesChannelId
          ?? `sc_mock_${MedusaProvisioningService.labelFor(organizationId)}`,
        salesChannelName: `LadiPage — ${organizationId}`,
        regionId: existing?.regionId ?? cfg.defaultRegionId,
        currencyCode: cfg.defaultCurrency,
        publishableKeyPreview: cfg.publishableKey
          ? `${cfg.publishableKey.slice(0, 8)}…`
          : 'mock_pk',
        status: 'active',
        healthMessage: 'Mock store link (no live Medusa)',
        provisionedAt: existing?.provisionedAt ?? new Date(),
      })
      return this.toDto(link)
    }

    try {
      const result = await this.provisioning.provision(organizationId)
      const link = await this.links.upsert(organizationId, {
        mode: 'hosted_shared',
        salesChannelId: result.salesChannelId,
        salesChannelName: result.salesChannelName,
        publishableKeyId: result.publishableKeyId,
        publishableKeyPreview: result.publishableKeyPreview,
        regionId: result.regionId ?? cfg.defaultRegionId,
        currencyCode: cfg.defaultCurrency,
        status: 'active',
        healthMessage: 'Live Medusa store link',
        provisionedAt: new Date(),
        lastHealthCheckAt: new Date(),
      })
      return this.toDto(link)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(
        `Provision failed org=${organizationId}: ${message}`,
      )
      const link = await this.links.upsert(organizationId, {
        mode: 'hosted_shared',
        currencyCode: cfg.defaultCurrency,
        status: 'error',
        healthMessage: `Provisioning failed: ${message}`.slice(0, 500),
      })
      return this.toDto(link)
    }
  }

  async updateStore(
    organizationId: string,
    patch: {
      salesChannelName?: string
      regionId?: string
      currencyCode?: string
      healthMessage?: string
    },
  ): Promise<CommerceStoreLinkDto> {
    const current = await this.ensureStore(organizationId)
    const salesChannelName =
      patch.salesChannelName?.trim() || current.salesChannelName

    if (!getCommerceConfig().mockMode && salesChannelName !== current.salesChannelName) {
      const result = await MedusaHttpClient.fromConfig('admin').post(
        `/admin/sales-channels/${encodeURIComponent(current.salesChannelId)}`,
        { name: salesChannelName },
      )
      if (!result.ok) {
        throw new Error(result.error ?? 'Unable to update Medusa sales channel')
      }
    }

    const entity = await this.links.upsert(organizationId, {
      salesChannelName,
      regionId: patch.regionId?.trim() || current.regionId,
      currencyCode:
        patch.currencyCode?.trim().toLowerCase() || current.currencyCode,
      healthMessage:
        patch.healthMessage === undefined
          ? current.healthMessage
          : patch.healthMessage.trim() || null,
    })
    return this.toDto(entity)
  }

  async createStorefrontSession(
    organizationId: string,
    pageId?: string,
  ): Promise<StorefrontSessionDto> {
    const cfg = getCommerceConfig()
    const link = await this.ensureStore(organizationId)

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

  private toDto(entity: CommerceStoreLinkEntity): CommerceStoreLinkDto {
    return {
      ladipageOrganizationId: entity.organizationId,
      medusaOrganizationId: null,
      salesChannelId: entity.salesChannelId ?? '',
      salesChannelName: entity.salesChannelName ?? `LadiPage — ${entity.organizationId}`,
      regionId: entity.regionId ?? '',
      currencyCode: entity.currencyCode,
      status: entity.status === 'active' ? 'active' : entity.status === 'error' ? 'error' : 'pending',
      healthMessage: entity.healthMessage ?? undefined,
      provisionedAt: entity.provisionedAt ? entity.provisionedAt.toISOString() : null,
      publishableKeyPreview: entity.publishableKeyPreview ?? undefined,
    }
  }
}
