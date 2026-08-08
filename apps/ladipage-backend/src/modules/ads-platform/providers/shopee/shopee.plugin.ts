import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type {
  AdsAccountReference,
  AdsBrowserSnapshotRequest,
  AdsOperationContext,
  AdsOperationResult,
  AdsProviderManifest,
  AdsProviderPlugin,
  AdsPublishPlan,
  AdsPublishRequest,
  AdsPublishResult,
  AdsPublishStepRequest,
  AdsPublishStepResult,
  AdsSnapshotEnvelope,
  AdsSyncRequest,
  AdsSyncResult,
  AdsValidationIssue,
  AdsValidationResult,
} from '@liora/ads-contracts'

import { AdsCredentialService } from '../../core/ads-credential.service'
import { AdsFingerprintService } from '../../core/ads-fingerprint.service'
import { AdsProviderRegistry } from '../../core/ads-provider-registry.service'
import { assertCredentialFreeSnapshot } from '../browser-snapshot.util'
import {
  normalizeProviderError,
  providerRequest,
  requireProviderBaseUrl,
} from '../provider-http.util'
import type { ShopeeCampaignDraft } from './shopee.types'

@Injectable()
export class ShopeeAdsPlugin implements AdsProviderPlugin, OnModuleInit {
  readonly manifest: AdsProviderManifest

  readonly connection = {
    getAuthorizationUrl: async (_context: AdsOperationContext, state: string) => {
      this.requirePartnerCapability('CONNECTION')
      const url = new URL(this.requireConfig('SHOPEE_ADS_AUTH_URL'))
      const allowedHosts = this.allowedHosts()
      if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname)) {
        throw new ServiceUnavailableException('SHOPEE_ADS_AUTH_URL is outside the approved host allowlist')
      }
      url.searchParams.set('client_id', this.requireConfig('SHOPEE_ADS_CLIENT_ID'))
      url.searchParams.set('redirect_uri', this.requireConfig('SHOPEE_ADS_REDIRECT_URI'))
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('state', state)
      return url.toString()
    },
    exchangeAuthorizationCode: async (code: string) => {
      this.requirePartnerCapability('CONNECTION')
      const response = await providerRequest<Record<string, unknown>>(
        this.baseUrl(),
        this.requireConfig('SHOPEE_ADS_TOKEN_PATH'),
        {
          method: 'POST',
          data: {
            client_id: this.requireConfig('SHOPEE_ADS_CLIENT_ID'),
            client_secret: this.requireConfig('SHOPEE_ADS_CLIENT_SECRET'),
            redirect_uri: this.requireConfig('SHOPEE_ADS_REDIRECT_URI'),
            code,
            grant_type: 'authorization_code',
          },
        },
      )
      const data = (response.data as Record<string, unknown> | undefined) ?? response
      const credential = data.access_token
      const identityField = this.configService.get<string>('SHOPEE_ADS_EXTERNAL_USER_ID_FIELD') ?? 'shop_id'
      const externalUserId = data[identityField] ?? data.user_id ?? data.account_id
      if (typeof credential !== 'string' || !credential || externalUserId == null) {
        throw new ServiceUnavailableException('Shopee partner token response is missing credential or identity')
      }
      const expiresIn = Number(data.expires_in)
      return {
        externalUserId: String(externalUserId),
        credential,
        expiresAt: Number.isFinite(expiresIn)
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : undefined,
        scopes: typeof data.scope === 'string' ? data.scope.split(/[ ,]+/).filter(Boolean) : [],
      }
    },
  }

  readonly discovery = {
    discoverAccounts: async (context: AdsOperationContext): Promise<AdsAccountReference[]> => {
      this.requirePartnerCapability('ACCOUNT_DISCOVERY')
      const response = await this.partnerRequest<Record<string, unknown>>(context, 'SHOPEE_ADS_ACCOUNTS_PATH', {
        method: 'GET',
      })
      const rows = this.extractRows(response)
      return rows.map((row) => ({
        externalId: String(row.shop_id ?? row.account_id ?? row.id ?? ''),
        name: String(row.shop_name ?? row.account_name ?? row.name ?? row.id ?? ''),
        currency: row.currency == null ? undefined : String(row.currency),
        timezone: row.timezone == null ? undefined : String(row.timezone),
        status: row.status == null ? undefined : String(row.status),
        metadata: { market: row.market ?? row.region ?? null },
      })).filter((account) => account.externalId)
    },
  }

  readonly sync = {
    sync: async (request: AdsSyncRequest, context: AdsOperationContext): Promise<AdsSyncResult> => {
      this.requirePartnerCapability('PERFORMANCE_SYNC')
      const configName = request.resource === 'PERFORMANCE'
        ? 'SHOPEE_ADS_PERFORMANCE_PATH'
        : 'SHOPEE_ADS_CAMPAIGNS_PATH'
      const response = await this.partnerRequest<Record<string, unknown>>(context, configName, {
        method: 'GET',
        params: {
          shop_id: request.externalAccountId,
          cursor: request.cursor,
          start_date: request.since,
          end_date: request.until,
        },
      })
      const observedAt = new Date().toISOString()
      const payload = { resource: request.resource, rows: this.extractRows(response) }
      const nextCursor = this.readString(response, ['next_cursor', 'nextCursor'])
      return {
        snapshots: [
          {
            schemaVersion: 1,
            provider: 'SHOPEE',
            source: 'PARTNER_API',
            tenantId: context.tenantId,
            connectionId: request.connectionId,
            externalAccountId: request.externalAccountId,
            observedAt,
            syncedAt: observedAt,
            confidence: 'AUTHORITATIVE',
            completeness: { ready: true, missingFields: [], warnings: [] },
            fingerprint: this.fingerprint.hash(payload),
            apiVersion: this.configService.get<string>('SHOPEE_ADS_API_VERSION'),
            payload,
          },
        ],
        nextCursor,
        complete: !nextCursor,
      }
    },
  }

  readonly browserSnapshot = {
    normalize: async (
      request: AdsBrowserSnapshotRequest,
      context: AdsOperationContext,
    ): Promise<AdsSnapshotEnvelope> => {
      assertCredentialFreeSnapshot(request.payload)
      return {
        schemaVersion: request.schemaVersion,
        provider: 'SHOPEE',
        source: 'BROWSER_EXTENSION',
        tenantId: context.tenantId,
        connectionId: context.connectionId,
        externalAccountId: request.externalAccountId,
        observedAt: request.observedAt,
        syncedAt: new Date().toISOString(),
        staleAt: new Date(Date.parse(request.observedAt) + 2 * 60 * 1000).toISOString(),
        confidence: 'SUPPLEMENTAL',
        completeness: {
          ready: false,
          missingFields: [],
          warnings: ['Browser-observed Shopee data is not canonical and cannot be used for publish'],
        },
        fingerprint: this.fingerprint.hash(request.payload),
        payload: request.payload,
      }
    },
  }

  readonly publish = {
    validate: async (draft: Record<string, unknown>) => this.validateDraft(draft),
    plan: async (): Promise<AdsPublishPlan> => {
      this.requirePartnerCapability('PUBLISH')
      return { steps: [{ key: 'campaign', kind: 'CREATE_CAMPAIGN', dependsOn: [] }] }
    },
    executeStep: async (
      input: AdsPublishStepRequest,
      context: AdsOperationContext,
    ): Promise<AdsPublishStepResult> => {
      this.requirePartnerCapability('PUBLISH')
      if (input.step.key !== 'campaign') {
        throw new ServiceUnavailableException(`Unknown Shopee publish step ${input.step.key}`)
      }
      const draft = input.request.draft as unknown as ShopeeCampaignDraft
      const response = await this.partnerRequest<Record<string, unknown>>(
        context,
        'SHOPEE_ADS_CAMPAIGN_CREATE_PATH',
        {
          method: 'POST',
          data: {
            shop_id: input.request.externalAccountId,
            campaign_name: draft.campaign.name,
            campaign_type: draft.campaign.type,
            budget: draft.campaign.budget,
            target_roas: draft.campaign.targetRoas,
            product_ids: draft.campaign.productIds,
            settings: draft.campaign.settings,
            status: this.configService.get<string>('SHOPEE_ADS_PAUSED_STATUS') ?? 'PAUSED',
          },
        },
      )
      const configuredField = this.configService.get<string>('SHOPEE_ADS_CAMPAIGN_ID_FIELD') ?? 'campaign_id'
      const id = response[configuredField] ?? (response.data as Record<string, unknown> | undefined)?.[configuredField]
      if (!id) throw new ServiceUnavailableException(`Shopee partner response did not contain ${configuredField}`)
      return { stepKey: input.step.key, externalId: String(id) }
    },
    reconcile: async (
      _request: AdsPublishRequest,
      externalIds: Record<string, string>,
      context: AdsOperationContext,
    ): Promise<AdsOperationResult<AdsPublishResult>> => {
      try {
        const pathTemplate = this.requireConfig('SHOPEE_ADS_CAMPAIGN_GET_PATH')
        const path = pathTemplate.replace('{campaignId}', encodeURIComponent(externalIds.campaign))
        await this.partnerRequestByPath<Record<string, unknown>>(context, path, { method: 'GET' })
        return {
          state: 'SUCCEEDED',
          data: { externalIds, checkpoint: 'campaign', status: 'PAUSED' },
          errors: [],
        }
      } catch (error) {
        return { state: 'PARTIAL', errors: [normalizeProviderError(error, 'SHOPEE_RECONCILE_FAILED')] }
      }
    },
  }

  constructor(
    private readonly registry: AdsProviderRegistry,
    private readonly configService: ConfigService,
    private readonly credentials: AdsCredentialService,
    private readonly fingerprint: AdsFingerprintService,
  ) {
    const partnerEnabled = this.configService.get<string>('SHOPEE_ADS_PARTNER_ENABLED') === 'true'
    const publishEnabled =
      partnerEnabled && this.configService.get<string>('SHOPEE_ADS_PUBLISH_ENABLED') === 'true'
    this.manifest = {
      provider: 'SHOPEE',
      version: this.configService.get<string>('SHOPEE_ADS_API_VERSION') ?? 'browser-observed-v1',
      canonicalSource: partnerEnabled ? 'PARTNER_API' : 'BROWSER_OBSERVED',
      capabilities: [
        'BROWSER_SNAPSHOT',
        ...(partnerEnabled
          ? (['CONNECTION', 'ACCOUNT_DISCOVERY', 'PERFORMANCE_SYNC'] as const)
          : []),
        ...(publishEnabled ? (['DRAFT_VALIDATION', 'PUBLISH', 'STATUS_ACTION', 'BUDGET_ACTION'] as const) : []),
      ],
    }
  }

  onModuleInit(): void {
    this.registry.register(this)
  }

  private validateDraft(draft: Record<string, unknown>): AdsValidationResult {
    const typed = draft as unknown as Partial<ShopeeCampaignDraft>
    const issues: AdsValidationIssue[] = []
    if (!typed.campaign?.name?.trim()) {
      issues.push({ severity: 'ERROR', code: 'REQUIRED', message: 'campaign.name is required', field: 'campaign.name' })
    }
    if (!typed.campaign?.type) {
      issues.push({ severity: 'ERROR', code: 'REQUIRED', message: 'campaign.type is required', field: 'campaign.type' })
    }
    if (!typed.campaign?.budget || typed.campaign.budget <= 0) {
      issues.push({ severity: 'ERROR', code: 'BUDGET_REQUIRED', message: 'A positive budget is required', field: 'campaign.budget' })
    }
    if (typed.campaign?.type === 'PRODUCT' && !typed.campaign.productIds?.length) {
      issues.push({
        severity: 'ERROR',
        code: 'PRODUCT_REQUIRED',
        message: 'Product campaigns require at least one product ID',
        field: 'campaign.productIds',
      })
    }
    return { valid: !issues.some((issue) => issue.severity === 'ERROR'), issues }
  }

  private requirePartnerCapability(
    capability: 'CONNECTION' | 'ACCOUNT_DISCOVERY' | 'PERFORMANCE_SYNC' | 'PUBLISH',
  ): void {
    if (!this.manifest.capabilities.includes(capability)) {
      throw new ServiceUnavailableException(
        `Shopee ${capability} requires an approved partner API and explicit configuration`,
      )
    }
  }

  private async partnerRequest<T>(
    context: AdsOperationContext,
    pathConfig: string,
    config: Parameters<typeof providerRequest<T>>[2],
  ): Promise<T> {
    return this.partnerRequestByPath(context, this.requireConfig(pathConfig), config)
  }

  private async partnerRequestByPath<T>(
    context: AdsOperationContext,
    path: string,
    config: Parameters<typeof providerRequest<T>>[2],
  ): Promise<T> {
    const token = await this.credentials.read(context)
    return providerRequest<T>(this.baseUrl(), path, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` },
    })
  }

  private baseUrl(): string {
    return requireProviderBaseUrl(
      this.configService.get<string>('SHOPEE_ADS_API_BASE_URL'),
      this.allowedHosts(),
      'SHOPEE_ADS_API_BASE_URL',
    )
  }

  private allowedHosts(): string[] {
    return this.requireConfig('SHOPEE_ADS_ALLOWED_HOSTS')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean)
  }

  private requireConfig(name: string): string {
    const value = this.configService.get<string>(name)
    if (!value) throw new ServiceUnavailableException(`${name} is not configured`)
    return value
  }

  private extractRows(response: Record<string, unknown>): Record<string, unknown>[] {
    const data = response.data as Record<string, unknown> | unknown[] | undefined
    const candidates = [
      response.list,
      response.rows,
      Array.isArray(data) ? data : data?.list,
      Array.isArray(data) ? undefined : data?.rows,
    ]
    return (candidates.find(Array.isArray) as Record<string, unknown>[] | undefined) ?? []
  }

  private readString(response: Record<string, unknown>, keys: string[]): string | undefined {
    const data = response.data as Record<string, unknown> | undefined
    for (const key of keys) {
      const value = response[key] ?? data?.[key]
      if (value != null && value !== '') return String(value)
    }
    return undefined
  }
}
