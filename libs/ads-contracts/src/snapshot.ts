import type { AdsProvider } from './provider'

export type AdsSnapshotSource =
  | 'OFFICIAL_API'
  | 'PARTNER_API'
  | 'BROWSER_EXTENSION'
  | 'DEV_FIXTURE'

export type AdsSnapshotConfidence =
  | 'AUTHORITATIVE'
  | 'SUPPLEMENTAL'
  | 'DIAGNOSTIC'

export interface AdsSnapshotCompleteness {
  ready: boolean
  missingFields: string[]
  warnings: string[]
}

export interface AdsSnapshotEnvelope<T = Record<string, unknown>> {
  schemaVersion: number
  provider: AdsProvider
  source: AdsSnapshotSource
  tenantId: number
  externalAccountId: string
  observedAt: string
  syncedAt: string
  confidence: AdsSnapshotConfidence
  completeness: AdsSnapshotCompleteness
  fingerprint: string
  payload: T
  connectionId?: string
  staleAt?: string
  apiVersion?: string
}
