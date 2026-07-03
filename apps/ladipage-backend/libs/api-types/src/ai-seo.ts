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
