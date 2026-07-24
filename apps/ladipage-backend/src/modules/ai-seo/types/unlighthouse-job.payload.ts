import type { LabScanDepth, LabScanPhase, LabScanTrigger } from '../queues/constants'

/**
 * BullMQ payload for Unlighthouse lab scans.
 * tenantId is authoritative for isolation — processor must re-check before writes.
 */
export type UnlighthouseJobPayload = {
  jobId: string
  tenantId: number
  seoProjectId: string
  seoProjectPageId: string | null
  websitePageId: string | null
  targetUrl: string
  trigger: LabScanTrigger
  phase: LabScanPhase
  depth: LabScanDepth
  device: 'mobile' | 'desktop'
  samples: number
  /** When true, runner never shells out to CLI (tests / no Chromium). */
  mock: boolean
}
