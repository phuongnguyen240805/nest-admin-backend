import { SeoProjectEntity, SeoProjectPageEntity } from '../entities'

export type AiSeoProjectPageDto = {
  id: string
  organizationId: string
  aiSeoProjectId: string
  projectId: string
  websitePageId: string | null
  pageUrl: string
  pageType: string
  source: 'internal' | 'external'
  scanStatus: 'pending' | 'scanning' | 'completed' | 'failed'
  lastScanJobId: string | null
  lastScannedAt: string | null
  createdAt: string
  updatedAt: string
  graderScore: number
  contentScore: number
  technicalScore: number
  uxScore: number
  authorityScore: number
}

function score(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

export function mapSeoProjectPageToDto(
  page: SeoProjectPageEntity,
  project: SeoProjectEntity,
  organizationId: string,
): AiSeoProjectPageDto {
  const holistic = project.holisticScores ?? {}
  const pageScores = page.scores ?? {}

  return {
    id: page.id,
    organizationId,
    aiSeoProjectId: project.id,
    projectId: project.id,
    websitePageId: page.websitePageId,
    pageUrl: page.pageUrl,
    pageType: 'landing_page',
    source: page.source,
    scanStatus: page.scanStatus,
    lastScanJobId: page.lastScanJobId,
    lastScannedAt: page.lastScannedAt?.toISOString() ?? null,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
    graderScore: score(pageScores.graderScore ?? holistic.aiGradeOverall),
    contentScore: score(pageScores.contentScore ?? holistic.contentScore),
    technicalScore: score(pageScores.technicalScore ?? holistic.technicalsScore),
    uxScore: score(pageScores.uxScore ?? holistic.uxScore),
    authorityScore: score(pageScores.authorityScore ?? holistic.authorityScore),
  }
}

export function mapLandingPageScores(page: SeoProjectPageEntity, project: SeoProjectEntity) {
  const holistic = project.holisticScores ?? {}
  const pageScores = page.scores ?? {}

  return {
    id: page.id,
    organization_id: String(project.tenantId),
    ai_seo_project_page_id: page.id,
    grader_score: score(pageScores.graderScore ?? holistic.aiGradeOverall),
    content_score: score(pageScores.contentScore ?? holistic.contentScore),
    technical_score: score(pageScores.technicalScore ?? holistic.technicalsScore),
    ux_score: score(pageScores.uxScore ?? holistic.uxScore),
    authority_score: score(pageScores.authorityScore ?? holistic.authorityScore),
    updated_at: page.updatedAt.toISOString(),
  }
}

export function mapLandingPageTask(task: {
  id: string
  projectId?: string
  seoProjectId?: string
  type: string
  status: string
  payload: Record<string, unknown>
  result: Record<string, unknown>
  createdAt: string | Date
  updatedAt: string | Date
}, pageId: string, tenantId: number) {
  const payload = task.payload ?? {}
  const result = task.result ?? {}

  return {
    id: task.id,
    organization_id: String(tenantId),
    ai_seo_project_page_id: pageId,
    ai_seo_project_id: task.seoProjectId ?? task.projectId ?? '',
    title: String(payload.title ?? result.title ?? `${task.type} task`),
    description: String(payload.description ?? result.description ?? ''),
    category: String(payload.category ?? task.type),
    priority: (payload.priority as 'high' | 'medium' | 'low') ?? 'medium',
    status: task.status === 'deployed' || task.status === 'approved' ? 'completed' : 'todo',
    before_value: (payload.before_value as string | null) ?? null,
    after_value: (result.after_value as string | null) ?? (result.suggestion as string | null) ?? null,
    created_at: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
    updated_at: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
  }
}