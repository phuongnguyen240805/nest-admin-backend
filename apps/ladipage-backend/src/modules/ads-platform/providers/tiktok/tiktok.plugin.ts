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
  AdsSyncRequest,
  AdsSyncResult,
  AdsSnapshotEnvelope,
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
import type { TikTokCampaignDraft, TikTokResponse } from './tiktok.types'

const TIKTOK_HOSTS = ['business-api.tiktok.com'] as const
const TIKTOK_AUTH_HOSTS = ['ads.tiktok.com', 'business-api.tiktok.com'] as const

@Injectable()
export class TikTokAdsPlugin implements AdsProviderPlugin, OnModuleInit {
  get manifest(): AdsProviderManifest {
    return {
      provider: 'TIKTOK',
      version: this.configService.get<string>('TIKTOK_API_VERSION') ?? 'UNCONFIGURED',
      canonicalSource: 'OFFICIAL_API',
      capabilities: [
        'CONNECTION',
        'ACCOUNT_DISCOVERY',
        'ASSET_SYNC',
        'PERFORMANCE_SYNC',
        'DRAFT_VALIDATION',
        'PUBLISH',
        'STATUS_ACTION',
        'BUDGET_ACTION',
        'WEBHOOK',
        'BROWSER_SNAPSHOT',
      ],
    }
  }

  readonly connection = {
    getAuthorizationUrl: async (_context: AdsOperationContext, state: string) => {
      const configured = this.requireConfig('TIKTOK_AUTH_URL')
      const url = new URL(configured)
      if (url.protocol !== 'https:' || !TIKTOK_AUTH_HOSTS.includes(url.hostname as never)) {
        throw new ServiceUnavailableException('TIKTOK_AUTH_URL must use an approved TikTok Ads host')
      }
      url.searchParams.set('app_id', this.requireConfig('TIKTOK_APP_ID'))
      url.searchParams.set('redirect_uri', this.requireConfig('TIKTOK_REDIRECT_URI'))
      url.searchParams.set('state', state)
      return url.toString()
    },
    exchangeAuthorizationCode: async (code: string, _context: AdsOperationContext) => {
      const response = await providerRequest<
        TikTokResponse<{ access_token: string; advertiser_ids?: string[]; advertiser_id?: string }>
      >(this.baseUrl(), '/oauth2/access_token/', {
        method: 'POST',
        data: {
          app_id: this.requireConfig('TIKTOK_APP_ID'),
          secret: this.requireConfig('TIKTOK_APP_SECRET'),
          auth_code: code,
        },
      })
      this.assertSuccess(response)
      const externalUserId = response.data.advertiser_id ?? response.data.advertiser_ids?.[0]
      if (!externalUserId) throw new ServiceUnavailableException('TikTok did not return an advertiser identity')
      return {
        externalUserId,
        credential: response.data.access_token,
        scopes: [],
      }
    },
  }

  readonly discovery = {
    discoverAccounts: async (context: AdsOperationContext): Promise<AdsAccountReference[]> => {
      const token = await this.credentials.read(context)
      const response = await providerRequest<
        TikTokResponse<{
          list?: Array<{
            advertiser_id: string
            advertiser_name?: string
            currency?: string
            timezone?: string
            status?: string
          }>
        }>
      >(this.baseUrl(), '/oauth2/advertiser/get/', {
        method: 'GET',
        headers: { 'Access-Token': token },
        params: { app_id: this.requireConfig('TIKTOK_APP_ID'), secret: this.requireConfig('TIKTOK_APP_SECRET') },
      })
      this.assertSuccess(response)
      return (response.data.list ?? []).map((account) => ({
        externalId: account.advertiser_id,
        name: account.advertiser_name ?? account.advertiser_id,
        currency: account.currency,
        timezone: account.timezone,
        status: account.status,
      }))
    },
  }

  readonly sync = {
    sync: async (request: AdsSyncRequest, context: AdsOperationContext): Promise<AdsSyncResult> => {
      const token = await this.credentials.read(context)
      const isPerformance = request.resource === 'PERFORMANCE'
      const path = isPerformance ? '/report/integrated/get/' : '/campaign/get/'
      const response = await providerRequest<
        TikTokResponse<{ list?: Record<string, unknown>[]; page_info?: { page?: number; total_page?: number } }>
      >(this.baseUrl(), path, {
        method: 'GET',
        headers: { 'Access-Token': token },
        params: isPerformance
          ? {
              advertiser_id: request.externalAccountId,
              report_type: 'BASIC',
              data_level: 'AUCTION_CAMPAIGN',
              dimensions: JSON.stringify(['campaign_id', 'stat_time_day']),
              metrics: JSON.stringify([
                'spend',
                'impressions',
                'clicks',
                'ctr',
                'cpc',
                'cpm',
                'conversion',
                'total_purchase_value',
                'purchase_roas',
              ]),
              start_date: request.since,
              end_date: request.until,
              page: Number(request.cursor ?? 1),
              page_size: 200,
            }
          : {
              advertiser_id: request.externalAccountId,
              page: Number(request.cursor ?? 1),
              page_size: 200,
            },
      })
      this.assertSuccess(response)
      const observedAt = new Date().toISOString()
      const payload = { resource: request.resource, rows: response.data.list ?? [] }
      const page = response.data.page_info?.page ?? Number(request.cursor ?? 1)
      const totalPage = response.data.page_info?.total_page ?? page
      return {
        snapshots: [
          {
            schemaVersion: 1,
            provider: 'TIKTOK',
            source: 'OFFICIAL_API',
            tenantId: context.tenantId,
            connectionId: request.connectionId,
            externalAccountId: request.externalAccountId,
            observedAt,
            syncedAt: observedAt,
            confidence: 'AUTHORITATIVE',
            completeness: { ready: true, missingFields: [], warnings: [] },
            fingerprint: this.fingerprint.hash(payload),
            apiVersion: this.requireConfig('TIKTOK_API_VERSION'),
            payload,
          },
        ],
        nextCursor: page < totalPage ? String(page + 1) : undefined,
        complete: page >= totalPage,
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
        provider: 'TIKTOK',
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
          warnings: ['Browser context is supplemental and cannot be used for TikTok publish'],
        },
        fingerprint: this.fingerprint.hash(request.payload),
        payload: request.payload,
      }
    },
  }

  readonly publish = {
    validate: async (draft: Record<string, unknown>) => this.validateDraft(draft),
    plan: async (): Promise<AdsPublishPlan> => ({
      steps: [
        { key: 'campaign', kind: 'CREATE_CAMPAIGN', dependsOn: [] },
        { key: 'adGroup', kind: 'CREATE_AD_GROUP', dependsOn: ['campaign'] },
        { key: 'ad', kind: 'CREATE_AD', dependsOn: ['adGroup'] },
      ],
    }),
    executeStep: async (
      input: AdsPublishStepRequest,
      context: AdsOperationContext,
    ): Promise<AdsPublishStepResult> => {
      const token = await this.credentials.read(context)
      const draft = input.request.draft as unknown as TikTokCampaignDraft
      let path: string
      let idField: string
      let data: Record<string, unknown>

      switch (input.step.key) {
        case 'campaign':
          path = '/campaign/create/'
          idField = 'campaign_id'
          data = {
            advertiser_id: input.request.externalAccountId,
            campaign_name: draft.campaign.campaignName,
            objective_type: draft.campaign.objectiveType,
            budget_mode: draft.campaign.budgetMode,
            budget: draft.campaign.budget,
            operation_status: 'DISABLE',
          }
          break
        case 'adGroup':
          path = '/adgroup/create/'
          idField = 'adgroup_id'
          data = {
            advertiser_id: input.request.externalAccountId,
            campaign_id: input.externalIds.campaign,
            adgroup_name: draft.adGroup.adgroupName,
            placement_type: draft.adGroup.placementType,
            promotion_type: draft.adGroup.promotionType,
            optimization_goal: draft.adGroup.optimizationGoal,
            budget_mode: draft.adGroup.budgetMode,
            budget: draft.adGroup.budget,
            schedule_type: draft.adGroup.scheduleType,
            schedule_start_time: draft.adGroup.scheduleStartTime,
            schedule_end_time: draft.adGroup.scheduleEndTime,
            pixel_id: draft.adGroup.pixelId,
            ...draft.adGroup.targeting,
            operation_status: 'DISABLE',
          }
          break
        case 'ad':
          path = '/ad/create/'
          idField = 'ad_id'
          data = {
            advertiser_id: input.request.externalAccountId,
            adgroup_id: input.externalIds.adGroup,
            ad_name: draft.ad.adName,
            identity_type: draft.ad.identityType,
            identity_id: draft.ad.identityId,
            creatives: draft.ad.creatives,
            operation_status: 'DISABLE',
          }
          break
        default:
          throw new ServiceUnavailableException(`Unknown TikTok publish step ${input.step.key}`)
      }
      const response = await providerRequest<TikTokResponse<Record<string, unknown>>>(
        this.baseUrl(),
        path,
        {
          method: 'POST',
          headers: { 'Access-Token': token },
          data: this.removeUndefined(data),
        },
      )
      this.assertSuccess(response)
      const externalId = response.data[idField]
      if (!externalId) throw new ServiceUnavailableException(`TikTok did not return ${idField}`)
      return { stepKey: input.step.key, externalId: String(externalId) }
    },
    reconcile: async (
      _request: AdsPublishRequest,
      externalIds: Record<string, string>,
      context: AdsOperationContext,
    ): Promise<AdsOperationResult<AdsPublishResult>> => {
      try {
        const token = await this.credentials.read(context)
        const response = await providerRequest<TikTokResponse<{ list?: unknown[] }>>(
          this.baseUrl(),
          '/ad/get/',
          {
            method: 'GET',
            headers: { 'Access-Token': token },
            params: {
              advertiser_id: context.externalAccountId,
              filtering: JSON.stringify({ ad_ids: [externalIds.ad] }),
            },
          },
        )
        this.assertSuccess(response)
        return {
          state: 'SUCCEEDED',
          data: { externalIds, checkpoint: 'ad', status: 'PAUSED' },
          errors: [],
        }
      } catch (error) {
        return { state: 'PARTIAL', errors: [normalizeProviderError(error, 'TIKTOK_RECONCILE_FAILED')] }
      }
    },
  }

  constructor(
    private readonly registry: AdsProviderRegistry,
    private readonly configService: ConfigService,
    private readonly credentials: AdsCredentialService,
    private readonly fingerprint: AdsFingerprintService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this)
  }

  private validateDraft(draft: Record<string, unknown>): AdsValidationResult {
    const typed = draft as unknown as Partial<TikTokCampaignDraft>
    const issues: AdsValidationIssue[] = []
    const required: Array<[unknown, string]> = [
      [typed.campaign?.campaignName, 'campaign.campaignName'],
      [typed.campaign?.objectiveType, 'campaign.objectiveType'],
      [typed.adGroup?.adgroupName, 'adGroup.adgroupName'],
      [typed.adGroup?.placementType, 'adGroup.placementType'],
      [typed.adGroup?.promotionType, 'adGroup.promotionType'],
      [typed.adGroup?.optimizationGoal, 'adGroup.optimizationGoal'],
      [typed.adGroup?.budgetMode, 'adGroup.budgetMode'],
      [typed.adGroup?.scheduleType, 'adGroup.scheduleType'],
      [typed.ad?.adName, 'ad.adName'],
    ]
    for (const [value, field] of required) {
      if (typeof value !== 'string' || !value.trim()) {
        issues.push({ severity: 'ERROR', code: 'REQUIRED', message: `${field} is required`, field })
      }
    }
    if (!typed.adGroup?.budget || typed.adGroup.budget <= 0) {
      issues.push({
        severity: 'ERROR',
        code: 'BUDGET_REQUIRED',
        message: 'A positive ad group budget is required',
        field: 'adGroup.budget',
      })
    }
    if (!typed.ad?.creatives?.length) {
      issues.push({
        severity: 'ERROR',
        code: 'CREATIVE_REQUIRED',
        message: 'At least one TikTok creative is required',
        field: 'ad.creatives',
      })
    }
    return { valid: !issues.some((issue) => issue.severity === 'ERROR'), issues }
  }

  private baseUrl(): string {
    const base = this.configService.get<string>('TIKTOK_API_BASE_URL')
    return requireProviderBaseUrl(base, TIKTOK_HOSTS, 'TIKTOK_API_BASE_URL')
  }

  private requireConfig(name: string): string {
    const value = this.configService.get<string>(name)
    if (!value) throw new ServiceUnavailableException(`${name} is not configured`)
    return value
  }

  private assertSuccess(response: TikTokResponse<unknown>): void {
    if (response.code !== 0) {
      throw new ServiceUnavailableException(`TikTok API error ${response.code}: ${response.message}`)
    }
  }

  private removeUndefined(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
  }
}
