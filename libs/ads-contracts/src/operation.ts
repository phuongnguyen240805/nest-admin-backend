import type { AdsProvider } from './provider'

export const ADS_OPERATION_STATES = [
  'CREATED',
  'AUTHORIZED',
  'VALIDATING',
  'QUEUED',
  'RUNNING',
  'RECONCILING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
] as const

export type AdsOperationState = (typeof ADS_OPERATION_STATES)[number]

export interface AdsOperationContext {
  operationId: string
  traceId: string
  tenantId: number
  actorId: string
  provider: AdsProvider
  source: string
  policyVersion: string
  providerVersion: string
  connectionId?: string
  externalAccountId?: string
  jobId?: string
}

export interface AdsOperationError {
  code: string
  message: string
  retryable: boolean
  remediation?: string
  field?: string
  providerCode?: string
  providerSubcode?: string
}

export interface AdsOperationResult<T = Record<string, unknown>> {
  state: Extract<AdsOperationState, 'SUCCEEDED' | 'PARTIAL' | 'FAILED'>
  data?: T
  errors: AdsOperationError[]
}
