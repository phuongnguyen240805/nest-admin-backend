import { SeoProjectEntity } from '../../src/modules/ai-seo/entities'
import { mapSeoProjectToDto } from '../../src/modules/ai-seo/mappers/seo-project.mapper'
import { mapSeoProjectPageToDto } from '../../src/modules/ai-seo/mappers/seo-project-page.mapper'
import { SeoProjectPageEntity } from '../../src/modules/ai-seo/entities/seo-project-page.entity'

const REQUIRED_PROJECT_FIELDS = [
  'id',
  'uuid',
  'projectId',
  'hostname',
  'name',
  'slug',
  'status',
  'taskStatus',
  'pixelTagState',
  'isFavorite',
  'isEngaged',
  'isFrozen',
  'holisticScores',
  'connectedData',
  'afterSummary',
  'aiGradeOverall',
  'siteAudit',
  'readyForProcessing',
  'isFirstProcessing',
  'timeSavedTotal',
  'createdAt',
  'updatedAt',
]

const REQUIRED_LANDING_PAGE_FIELDS = [
  'id',
  'organizationId',
  'aiSeoProjectId',
  'projectId',
  'pageUrl',
  'pageType',
  'source',
  'scanStatus',
  'graderScore',
  'contentScore',
  'technicalScore',
  'uxScore',
  'authorityScore',
  'createdAt',
  'updatedAt',
]

describe('AI SEO contract parity', () => {
  it('SeoProjectDto exposes all fields used by FE project cards', () => {
    const now = new Date('2026-07-02T00:00:00.000Z')
    const project = Object.assign(new SeoProjectEntity(), {
      id: '41f02f11-e1d3-463d-a1bd-f6cb68a29322',
      tenantId: 1,
      storeId: null,
      landingPageId: null,
      name: 'Demo SEO',
      hostname: 'example.com',
      slug: 'example-com',
      status: 'draft',
      openseoProjectId: null,
      taskStatus: 'pending',
      pixelTagState: 'not_installed',
      isFavorite: false,
      isEngaged: true,
      holisticScores: {},
      connectedData: {},
      siteAudit: {},
      lastAnalysisAt: null,
      createdAt: now,
      updatedAt: now,
    })

    const dto = mapSeoProjectToDto(project)
    const keys = Object.keys(dto)

    for (const field of REQUIRED_PROJECT_FIELDS) {
      expect(keys).toContain(field)
    }
    expect(keys.length).toBeGreaterThanOrEqual(20)
  })

  it('AiSeoProjectPage DTO matches FE landing page panel shape', () => {
    const now = new Date('2026-07-02T00:00:00.000Z')
    const project = Object.assign(new SeoProjectEntity(), {
      id: 'project-1',
      tenantId: 1,
      hostname: 'example.com',
      holisticScores: { contentScore: 50, technicalsScore: 60 },
    })
    const page = Object.assign(new SeoProjectPageEntity(), {
      id: 'page-1',
      tenantId: 1,
      seoProjectId: 'project-1',
      pageUrl: 'https://example.com',
      websitePageId: 'lp-1',
      source: 'external',
      scanStatus: 'pending',
      scores: {},
      createdAt: now,
      updatedAt: now,
    })

    const dto = mapSeoProjectPageToDto(page, project, '1')
    const keys = Object.keys(dto)

    for (const field of REQUIRED_LANDING_PAGE_FIELDS) {
      expect(keys).toContain(field)
    }
  })
})