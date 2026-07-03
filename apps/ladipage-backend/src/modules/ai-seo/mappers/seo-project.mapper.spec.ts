import { SeoProjectEntity } from '../entities'
import { mapSeoProjectToDto } from './seo-project.mapper'

describe('mapSeoProjectToDto', () => {
  it('keeps the legacy FE project card shape', () => {
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
      holisticScores: {
        technicalsScore: 80,
        uxScore: 70,
        authorityScore: 60,
        contentScore: 90,
      },
      connectedData: {},
      siteAudit: {},
      lastAnalysisAt: null,
      createdAt: now,
      updatedAt: now,
    })

    const dto = mapSeoProjectToDto(project)

    expect(dto).toMatchObject({
      id: project.id,
      uuid: project.id,
      projectId: project.id,
      hostname: 'example.com',
      taskStatus: 'pending',
      pixelTagState: 'not_installed',
      readyForProcessing: true,
      isFirstProcessing: true,
      connectedData: {
        isGscConnected: false,
        isGbpConnected: false,
        gscDetails: {},
        gbpDetailsV2: {},
      },
      afterSummary: {
        healthyPages: 0,
        totalPages: 0,
      },
      holisticScores: {
        technicalsScore: 80,
        uxScore: 70,
        authorityScore: 60,
        contentScore: 90,
      },
      aiGradeOverall: 75,
      publishedAt: null,
    })

    expect(Object.keys(dto).length).toBeGreaterThanOrEqual(20)
  })
})
