import type { AdsOperationContext, AdsOperationResult } from './operation'
import type { AdsCapability, AdsProviderManifest } from './provider'
import type { AdsSnapshotEnvelope } from './snapshot'

export interface AdsAccountReference {
  externalId: string
  name: string
  currency?: string
  timezone?: string
  status?: string
  metadata?: Record<string, unknown>
}

export interface AdsSyncRequest {
  connectionId: string
  externalAccountId: string
  resource: 'ACCOUNTS' | 'ASSETS' | 'CAMPAIGNS' | 'PERFORMANCE'
  cursor?: string
  since?: string
  until?: string
}

export interface AdsSyncResult {
  snapshots: AdsSnapshotEnvelope[]
  nextCursor?: string
  complete: boolean
}

export interface AdsBrowserSnapshotRequest {
  externalAccountId: string
  observedAt: string
  schemaVersion: number
  payload: Record<string, unknown>
}

export interface AdsBrowserSnapshotPort {
  normalize(
    request: AdsBrowserSnapshotRequest,
    context: AdsOperationContext,
  ): Promise<AdsSnapshotEnvelope>
}

export interface AdsValidationIssue {
  severity: 'ERROR' | 'WARNING'
  code: string
  message: string
  field?: string
}

export interface AdsValidationResult {
  valid: boolean
  issues: AdsValidationIssue[]
}

export interface AdsPublishRequest<TDraft = Record<string, unknown>> {
  connectionId: string
  externalAccountId: string
  idempotencyKey: string
  revision: number
  draftHash: string
  draft: TDraft
}

export interface AdsPublishResult {
  externalIds: Record<string, string>
  checkpoint: string
  status: 'PAUSED'
}

export interface AdsPublishStep {
  key: string
  kind: string
  dependsOn: string[]
}

export interface AdsPublishPlan {
  steps: AdsPublishStep[]
}

export interface AdsPublishStepRequest<TDraft = Record<string, unknown>> {
  request: AdsPublishRequest<TDraft>
  step: AdsPublishStep
  externalIds: Record<string, string>
}

export interface AdsPublishStepResult {
  stepKey: string
  externalId?: string
  metadata?: Record<string, unknown>
}

export interface AdsConnectionPort {
  getAuthorizationUrl(
    context: AdsOperationContext,
    state: string,
    returnTo?: string,
  ): Promise<string>
  exchangeAuthorizationCode(
    code: string,
    context: AdsOperationContext,
  ): Promise<{ externalUserId: string; credential: string; expiresAt?: string; scopes: string[] }>
}

export interface AdsDiscoveryPort {
  discoverAccounts(context: AdsOperationContext): Promise<AdsAccountReference[]>
}

export interface AdsSyncPort {
  sync(request: AdsSyncRequest, context: AdsOperationContext): Promise<AdsSyncResult>
}

export interface AdsPublishPort<TDraft = Record<string, unknown>> {
  validate(draft: TDraft, context: AdsOperationContext): Promise<AdsValidationResult>
  plan(draft: TDraft, context: AdsOperationContext): Promise<AdsPublishPlan>
  executeStep(
    request: AdsPublishStepRequest<TDraft>,
    context: AdsOperationContext,
  ): Promise<AdsPublishStepResult>
  reconcile(
    request: AdsPublishRequest<TDraft>,
    externalIds: Record<string, string>,
    context: AdsOperationContext,
  ): Promise<AdsOperationResult<AdsPublishResult>>
}

export interface AdsProviderPlugin {
  manifest: AdsProviderManifest
  connection?: AdsConnectionPort
  discovery?: AdsDiscoveryPort
  sync?: AdsSyncPort
  publish?: AdsPublishPort
  browserSnapshot?: AdsBrowserSnapshotPort
}

export function assertPluginCapability(
  plugin: AdsProviderPlugin,
  capability: AdsCapability,
): void {
  if (!plugin.manifest.capabilities.includes(capability)) {
    throw new Error(`${plugin.manifest.provider} does not support ${capability}`)
  }
}
