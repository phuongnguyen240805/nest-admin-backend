import { Injectable, Logger } from '@nestjs/common'

import { getCommerceConfig } from '../commerce.config'
import { MedusaHttpClient } from '../clients/medusa-http.client'

type MedusaSalesChannel = { id?: string; name?: string }
type MedusaSalesChannelList = { sales_channels?: MedusaSalesChannel[] }
type MedusaSalesChannelEnvelope = { sales_channel?: MedusaSalesChannel }

type MedusaPublishableKey = {
  id?: string
  title?: string
  token?: string
  redacted?: string
}
type MedusaApiKeyList = { api_keys?: MedusaPublishableKey[] }
type MedusaApiKeyEnvelope = { api_key?: MedusaPublishableKey }

type MedusaRegion = { id?: string; name?: string; currency_code?: string }
type MedusaRegionList = { regions?: MedusaRegion[] }

export type ProvisionResult = {
  salesChannelId: string
  salesChannelName: string
  publishableKeyId: string | null
  publishableKeyPreview: string | null
  regionId: string | null
}

/**
 * Provisions the real Medusa objects that back one org's store:
 * a Sales Channel and a Publishable API Key scoped to it (ADR-005).
 * All operations are idempotent — they reuse an existing channel/key
 * matched by the deterministic name/title derived from organizationId.
 *
 * Only ever called from the trusted control plane (Nest) with the Admin
 * key; never exposed to the browser.
 */
@Injectable()
export class MedusaProvisioningService {
  private readonly logger = new Logger(MedusaProvisioningService.name)

  /** Deterministic, collision-safe channel/key label for an org. */
  static labelFor(organizationId: string): string {
    const safe = organizationId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
    return `lp_${safe}`
  }

  async provision(organizationId: string): Promise<ProvisionResult> {
    const admin = MedusaHttpClient.fromConfig('admin')
    const label = MedusaProvisioningService.labelFor(organizationId)

    const channel = await this.ensureSalesChannel(admin, label, organizationId)
    const key = await this.ensurePublishableKey(admin, label, channel.id)
    const regionId = await this.resolveRegionId(admin)

    return {
      salesChannelId: channel.id,
      salesChannelName: channel.name,
      publishableKeyId: key?.id ?? null,
      publishableKeyPreview: key?.preview ?? null,
      regionId,
    }
  }

  private async ensureSalesChannel(
    admin: MedusaHttpClient,
    label: string,
    organizationId: string,
  ): Promise<{ id: string; name: string }> {
    const existing = await admin.get<MedusaSalesChannelList>(
      `/admin/sales-channels?q=${encodeURIComponent(label)}&limit=100`,
    )
    if (existing.ok) {
      const match = (existing.data?.sales_channels ?? []).find(
        (c) => c.name === label,
      )
      if (match?.id) {
        return { id: match.id, name: match.name ?? label }
      }
    }

    const created = await admin.post<MedusaSalesChannelEnvelope>(
      '/admin/sales-channels',
      {
        name: label,
        description: `LadiPage store for organization ${organizationId}`,
        metadata: { ladipage_organization_id: organizationId },
      },
    )
    if (!created.ok || !created.data?.sales_channel?.id) {
      throw new Error(
        created.error ?? 'Failed to create Medusa sales channel',
      )
    }
    return {
      id: created.data.sales_channel.id,
      name: created.data.sales_channel.name ?? label,
    }
  }

  private async ensurePublishableKey(
    admin: MedusaHttpClient,
    label: string,
    salesChannelId: string,
  ): Promise<{ id: string; preview: string | null } | null> {
    const title = `${label}_pk`

    const existing = await admin.get<MedusaApiKeyList>(
      '/admin/api-keys?type=publishable&limit=100',
    )
    let keyId: string | null = null
    let preview: string | null = null

    if (existing.ok) {
      const match = (existing.data?.api_keys ?? []).find(
        (k) => k.title === title,
      )
      if (match?.id) {
        keyId = match.id
        preview = match.redacted ?? this.previewToken(match.token)
      }
    }

    if (!keyId) {
      const created = await admin.post<MedusaApiKeyEnvelope>(
        '/admin/api-keys',
        { title, type: 'publishable' },
      )
      if (!created.ok || !created.data?.api_key?.id) {
        // Non-fatal: channel still provisioned; storefront can bootstrap later.
        this.logger.warn(
          `Publishable key create failed for ${title}: ${created.error ?? created.status}`,
        )
        return null
      }
      keyId = created.data.api_key.id
      preview =
        created.data.api_key.redacted
        ?? this.previewToken(created.data.api_key.token)
    }

    // Idempotent link of the key to the channel.
    const linked = await admin.post(
      `/admin/api-keys/${keyId}/sales-channels`,
      { add: [salesChannelId] },
    )
    if (!linked.ok) {
      this.logger.warn(
        `Link publishable key ${keyId} → channel ${salesChannelId} failed: ${linked.error ?? linked.status}`,
      )
    }

    return { id: keyId, preview }
  }

  private async resolveRegionId(
    admin: MedusaHttpClient,
  ): Promise<string | null> {
    const cfg = getCommerceConfig()
    const res = await admin.get<MedusaRegionList>('/admin/regions?limit=100')
    if (!res.ok) return null
    const regions = res.data?.regions ?? []
    const byCurrency = regions.find(
      (r) => r.currency_code?.toLowerCase() === cfg.defaultCurrency,
    )
    return byCurrency?.id ?? regions[0]?.id ?? null
  }

  private previewToken(token?: string): string | null {
    if (!token) return null
    return `${token.slice(0, 8)}…`
  }
}
