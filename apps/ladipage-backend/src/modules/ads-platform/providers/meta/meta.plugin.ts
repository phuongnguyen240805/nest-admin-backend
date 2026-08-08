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
import type { MetaCampaignDraft, MetaGraphIdResponse, MetaGraphPage } from './meta.types'

const META_HOSTS = ['graph.facebook.com', 'www.facebook.com'] as const

@Injectable()
export class MetaAdsPlugin implements AdsProviderPlugin, OnModuleInit {
  get manifest(): AdsProviderManifest {
    return {
      provider: 'META',
      version: this.configService.get<string>('META_API_VERSION') ?? 'UNCONFIGURED',
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
      const appId = this.requireConfig('META_APP_ID')
      const redirectUri = this.requireConfig('META_REDIRECT_URI')
      const version = this.requireConfig('META_API_VERSION')
      const scopes = this.configService.get<string>('META_ADS_SCOPES') ??
        'ads_management,ads_read,business_management,pages_read_engagement'
      const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`)
      url.searchParams.set('client_id', appId)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('state', state)
      url.searchParams.set('scope', scopes)
      url.searchParams.set('response_type', 'code')
      return url.toString()
    },
    exchangeAuthorizationCode: async (code: string, _context: AdsOperationContext) => {
      const baseURL = this.graphBaseUrl()
      const response = await providerRequest<{
        access_token: string
        expires_in?: number
      }>(baseURL, '/oauth/access_token', {
        method: 'GET',
        params: {
          client_id: this.requireConfig('META_APP_ID'),
          client_secret: this.requireConfig('META_APP_SECRET'),
          redirect_uri: this.requireConfig('META_REDIRECT_URI'),
          code,
        },
      })
      const profile = await providerRequest<{ id: string; name?: string }>(baseURL, '/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${response.access_token}` },
        params: { fields: 'id,name' },
      })
      return {
        externalUserId: profile.id,
        credential: response.access_token,
        expiresAt: response.expires_in
          ? new Date(Date.now() + response.expires_in * 1000).toISOString()
          : undefined,
        scopes: (this.configService.get<string>('META_ADS_SCOPES') ?? '').split(',').filter(Boolean),
      }
    },
  }

  readonly discovery = {
    discoverAccounts: async (context: AdsOperationContext): Promise<AdsAccountReference[]> => {
      const token = await this.credentials.read(context)
      const response = await providerRequest<
        MetaGraphPage<{
          id: string
          name: string
          currency?: string
          timezone_name?: string
          account_status?: number
        }>
      >(this.graphBaseUrl(), '/me/adaccounts', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        params: { fields: 'id,name,currency,timezone_name,account_status', limit: 200 },
      })
      return response.data.map((account) => ({
        externalId: account.id.replace(/^act_/, ''),
        name: account.name,
        currency: account.currency,
        timezone: account.timezone_name,
        status: account.account_status == null ? undefined : String(account.account_status),
      }))
    },
  }

  readonly sync = {
    sync: async (request: AdsSyncRequest, context: AdsOperationContext): Promise<AdsSyncResult> => {
      const token = await this.credentials.read(context)
      const account = `act_${request.externalAccountId.replace(/^act_/, '')}`
      const path = request.resource === 'PERFORMANCE' ? `/${account}/insights` : `/${account}/campaigns`
      const params = request.resource === 'PERFORMANCE'
        ? {
            fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values',
            level: 'campaign',
            time_increment: 1,
            limit: 200,
            after: request.cursor,
            ...(request.since && request.until
              ? { time_range: JSON.stringify({ since: request.since, until: request.until }) }
              : {}),
          }
        : {
            fields: 'id,name,status,effective_status,objective,created_time,updated_time',
            limit: 200,
            after: request.cursor,
          }
      const response = await providerRequest<MetaGraphPage<Record<string, unknown>>>(
        this.graphBaseUrl(),
        path,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` }, params },
      )
      const observedAt = new Date().toISOString()
      const payload = { resource: request.resource, rows: response.data }
      return {
        snapshots: [
          {
            schemaVersion: 1,
            provider: 'META',
            source: 'OFFICIAL_API',
            tenantId: context.tenantId,
            connectionId: request.connectionId,
            externalAccountId: request.externalAccountId,
            observedAt,
            syncedAt: observedAt,
            confidence: 'AUTHORITATIVE',
            completeness: { ready: true, missingFields: [], warnings: [] },
            fingerprint: this.fingerprint.hash(payload),
            apiVersion: this.requireConfig('META_API_VERSION'),
            payload,
          },
        ],
        nextCursor: response.paging?.cursors?.after,
        complete: !response.paging?.next,
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
        provider: 'META',
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
          warnings: ['Browser context is supplemental and cannot be used for Meta publish'],
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
        { key: 'adSet', kind: 'CREATE_ADSET', dependsOn: ['campaign'] },
        { key: 'creative', kind: 'CREATE_CREATIVE', dependsOn: [] },
        { key: 'ad', kind: 'CREATE_AD', dependsOn: ['adSet', 'creative'] },
      ],
    }),
    executeStep: async (
      input: AdsPublishStepRequest,
      context: AdsOperationContext,
    ): Promise<AdsPublishStepResult> => {
      const token = await this.credentials.read(context)
      const draft = input.request.draft as unknown as MetaCampaignDraft
      const account = `act_${input.request.externalAccountId.replace(/^act_/, '')}`
      let path = `/${account}/campaigns`
      let data: Record<string, unknown>

      switch (input.step.key) {
        case 'campaign':
          data = {
            name: draft.campaign.name,
            objective: draft.campaign.objective,
            special_ad_categories: draft.campaign.specialAdCategories ?? [],
            status: 'PAUSED',
          }
          break
        case 'adSet':
          path = `/${account}/adsets`
          data = {
            name: draft.adSet.name,
            campaign_id: input.externalIds.campaign,
            daily_budget: draft.adSet.dailyBudget,
            lifetime_budget: draft.adSet.lifetimeBudget,
            billing_event: draft.adSet.billingEvent,
            optimization_goal: draft.adSet.optimizationGoal,
            bid_strategy: draft.adSet.bidStrategy,
            promoted_object: draft.adSet.promotedObject,
            targeting: draft.adSet.targeting,
            start_time: draft.adSet.startTime,
            end_time: draft.adSet.endTime,
            status: 'PAUSED',
          }
          break
        case 'creative':
          path = `/${account}/adcreatives`
          data = {
            name: draft.creative.name,
            object_story_spec: draft.creative.objectStorySpec,
            object_story_id: draft.creative.objectStoryId,
          }
          break
        case 'ad':
          path = `/${account}/ads`
          data = {
            name: draft.ad.name,
            adset_id: input.externalIds.adSet,
            creative: { creative_id: input.externalIds.creative },
            status: 'PAUSED',
          }
          break
        default:
          throw new ServiceUnavailableException(`Unknown Meta publish step ${input.step.key}`)
      }
      const response = await providerRequest<MetaGraphIdResponse>(this.graphBaseUrl(), path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        data: this.removeUndefined(data),
      })
      return { stepKey: input.step.key, externalId: response.id }
    },
    reconcile: async (
      _request: AdsPublishRequest,
      externalIds: Record<string, string>,
      context: AdsOperationContext,
    ): Promise<AdsOperationResult<AdsPublishResult>> => {
      try {
        const token = await this.credentials.read(context)
        await providerRequest(this.graphBaseUrl(), `/${externalIds.ad}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          params: { fields: 'id,status,effective_status' },
        })
        return {
          state: 'SUCCEEDED',
          data: { externalIds, checkpoint: 'ad', status: 'PAUSED' },
          errors: [],
        }
      } catch (error) {
        return { state: 'PARTIAL', errors: [normalizeProviderError(error, 'META_RECONCILE_FAILED')] }
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
    const typed = draft as unknown as Partial<MetaCampaignDraft>
    const issues: AdsValidationIssue[] = []
    const required: Array<[unknown, string]> = [
      [typed.campaign?.name, 'campaign.name'],
      [typed.campaign?.objective, 'campaign.objective'],
      [typed.adSet?.name, 'adSet.name'],
      [typed.adSet?.billingEvent, 'adSet.billingEvent'],
      [typed.adSet?.optimizationGoal, 'adSet.optimizationGoal'],
      [typed.creative?.name, 'creative.name'],
      [typed.ad?.name, 'ad.name'],
    ]
    for (const [value, field] of required) {
      if (typeof value !== 'string' || !value.trim()) {
        issues.push({ severity: 'ERROR', code: 'REQUIRED', message: `${field} is required`, field })
      }
    }
    if (!typed.adSet?.dailyBudget && !typed.adSet?.lifetimeBudget) {
      issues.push({
        severity: 'ERROR',
        code: 'BUDGET_REQUIRED',
        message: 'An ad set daily or lifetime budget is required',
        field: 'adSet',
      })
    }
    if (typed.adSet?.dailyBudget && typed.adSet?.lifetimeBudget) {
      issues.push({
        severity: 'ERROR',
        code: 'BUDGET_CONFLICT',
        message: 'Choose either dailyBudget or lifetimeBudget, not both',
        field: 'adSet',
      })
    }
    for (const [value, field] of [
      [typed.adSet?.dailyBudget, 'adSet.dailyBudget'],
      [typed.adSet?.lifetimeBudget, 'adSet.lifetimeBudget'],
    ] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
        issues.push({
          severity: 'ERROR',
          code: 'BUDGET_INVALID',
          message: `${field} must be a positive integer in the account minor currency unit`,
          field,
        })
      }
    }
    const storySources = Number(Boolean(typed.creative?.objectStorySpec)) +
      Number(Boolean(typed.creative?.objectStoryId))
    if (storySources !== 1) {
      issues.push({
        severity: 'ERROR',
        code: 'CREATIVE_STORY_REQUIRED',
        message: 'Provide exactly one of creative.objectStorySpec or creative.objectStoryId',
        field: 'creative',
      })
    }
    if (typed.adSet?.startTime && typed.adSet?.endTime) {
      const start = Date.parse(typed.adSet.startTime)
      const end = Date.parse(typed.adSet.endTime)
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        issues.push({
          severity: 'ERROR',
          code: 'SCHEDULE_INVALID',
          message: 'adSet.endTime must be a valid time after adSet.startTime',
          field: 'adSet.endTime',
        })
      }
    }
    return { valid: !issues.some((issue) => issue.severity === 'ERROR'), issues }
  }

  private graphBaseUrl(): string {
    const version = this.requireConfig('META_API_VERSION')
    return requireProviderBaseUrl(
      `https://graph.facebook.com/${version}`,
      META_HOSTS,
      'META_API_VERSION',
    )
  }

  private requireConfig(name: string): string {
    const value = this.configService.get<string>(name)
    if (!value) throw new ServiceUnavailableException(`${name} is not configured`)
    return value
  }

  private removeUndefined(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
  }
}
