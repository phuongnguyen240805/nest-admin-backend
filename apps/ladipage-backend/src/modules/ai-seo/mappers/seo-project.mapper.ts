import type { SeoProjectDto } from '@liora/api-types'

import { SeoProjectEntity } from '../entities'

type HolisticScores = SeoProjectDto['holisticScores']
type ConnectedData = SeoProjectDto['connectedData']

const DEFAULT_SCORES: HolisticScores = {
  technicalsScore: 0,
  uxScore: 0,
  authorityScore: 0,
  contentScore: 0,
}

const DEFAULT_CONNECTED_DATA: ConnectedData = {
  isGscConnected: false,
  isGbpConnected: false,
  gscDetails: {},
  gbpDetailsV2: {},
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function mapScores(value: Record<string, unknown> | null | undefined): HolisticScores {
  return {
    ...DEFAULT_SCORES,
    ...(value ?? {}),
    technicalsScore: numberOrZero(value?.technicalsScore),
    uxScore: numberOrZero(value?.uxScore),
    authorityScore: numberOrZero(value?.authorityScore),
    contentScore: numberOrZero(value?.contentScore),
  }
}

function mapConnectedData(value: Record<string, unknown> | null | undefined): ConnectedData {
  return {
    ...DEFAULT_CONNECTED_DATA,
    ...(value ?? {}),
    gscDetails: (value?.gscDetails as Record<string, unknown>) ?? {},
    gbpDetailsV2: (value?.gbpDetailsV2 as Record<string, unknown>) ?? {},
  }
}

function averageScore(scores: HolisticScores): number {
  const values = [
    scores.technicalsScore,
    scores.uxScore,
    scores.authorityScore,
    scores.contentScore,
  ]
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function mapSeoProjectToDto(project: SeoProjectEntity): SeoProjectDto {
  const holisticScores = mapScores(project.holisticScores)
  const connectedData = mapConnectedData(project.connectedData)
  const createdAt = toIso(project.createdAt) ?? new Date(0).toISOString()
  const updatedAt = toIso(project.updatedAt) ?? createdAt
  const lastAnalysis = toIso(project.lastAnalysisAt)

  return {
    id: project.id,
    uuid: project.id,
    projectId: project.id,
    hostname: project.hostname,
    name: project.name,
    slug: project.slug,
    status: project.status,
    siteAudit: project.siteAudit ?? {},
    readyForProcessing: project.taskStatus !== 'running',
    isFirstProcessing: !project.lastAnalysisAt,
    taskStatus: project.taskStatus,
    pixelTagState: project.pixelTagState,
    isFrozen: false,
    isFavorite: project.isFavorite,
    isEngaged: project.isEngaged ?? true,
    atRiskOfWipe: false,
    daysUntilWipe: null,
    wipeScheduledAt: null,
    lastAnalysis,
    nextAnalysisAt: null,
    timeSavedTotal: 0,
    createdAt,
    updatedAt,
    publishedAt: null,
    connectedData,
    afterSummary: {
      healthyPages: 0,
      totalPages: 0,
    },
    holisticScores,
    aiGradeOverall: numberOrZero(project.holisticScores?.aiGradeOverall) || averageScore(holisticScores),
  }
}
