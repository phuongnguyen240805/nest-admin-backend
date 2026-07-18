export interface SeoHolisticScoresDto {
  technicalsScore: number
  uxScore: number
  authorityScore: number
  contentScore: number
  aiGradeOverall?: number
  [key: string]: unknown
}

export interface SeoConnectedDataDto {
  isGscConnected: boolean
  isGbpConnected: boolean
  gscDetails: Record<string, unknown>
  gbpDetailsV2: Record<string, unknown>
  [key: string]: unknown
}

export interface SeoProjectDto {
  id: string
  uuid: string
  projectId: string
  hostname: string
  name: string
  slug: string
  status: string
  taskStatus: string
  pixelTagState: string
  isFavorite: boolean
  isEngaged: boolean
  isFrozen: boolean
  holisticScores: SeoHolisticScoresDto
  connectedData: SeoConnectedDataDto
  afterSummary: { healthyPages: number; totalPages: number }
  aiGradeOverall: number
  siteAudit: Record<string, unknown>
  readyForProcessing: boolean
  isFirstProcessing: boolean
  timeSavedTotal: number
  atRiskOfWipe: boolean
  daysUntilWipe: number | null
  wipeScheduledAt: string | null
  lastAnalysis: string | null
  nextAnalysisAt: string | null
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
}

export interface SeoTaskDto {
  id: string
  projectId: string
  externalTaskId: string | null
  type: string
  status: string
  payload: Record<string, unknown>
  result: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** Umami traffic envelope from Nest AI-SEO adapter (fail-soft). */
export type SeoTrafficStatus = 'ok' | 'degraded' | 'not_configured' | 'disabled'

export type SeoTrafficRange = '7d' | '30d'

export type SeoTrafficMetricType = 'referrer' | 'url' | 'device' | 'country' | 'event'

export interface SeoTrafficStatsDto {
  pageviews: number
  visitors: number
  visits: number
  bounces: number
  totaltime: number
}

export interface SeoTrafficEnvelopeDto<T = SeoTrafficStatsDto | null> {
  status: SeoTrafficStatus
  stale: boolean
  syncedAt: string | null
  range: { start: string; end: string } | null
  data: T
  message?: string
}

export interface SeoTrafficMetricRowDto {
  x: string
  y: number
}

export interface SeoTrafficHealthDto {
  ok: boolean
  circuit?: string
  enabled?: boolean
  latencyMs?: number
}

export interface SeoTrafficProvisionDto {
  status: SeoTrafficStatus | 'degraded' | 'ok'
  umamiWebsiteId: string | null
  message?: string
}
