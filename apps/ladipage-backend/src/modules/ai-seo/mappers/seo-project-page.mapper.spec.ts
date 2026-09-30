import { SeoProjectEntity, SeoProjectPageEntity } from '../entities'
import { linkedPageDisplayName, mapSeoProjectPageToDto } from './seo-project-page.mapper'

describe('mapSeoProjectPageToDto', () => {
  it('maps linked landing page to FE AiSeoProjectPage shape', () => {
    const now = new Date('2026-07-02T00:00:00.000Z')
    const project = Object.assign(new SeoProjectEntity(), {
      id: 'project-1',
      tenantId: 7,
      hostname: 'example.com',
      holisticScores: {
        technicalsScore: 80,
        uxScore: 70,
        authorityScore: 60,
        contentScore: 90,
        aiGradeOverall: 75,
      },
    })
    const page = Object.assign(new SeoProjectPageEntity(), {
      id: 'page-1',
      tenantId: 7,
      seoProjectId: 'project-1',
      pageUrl: 'https://example.com/landing',
      websitePageId: 'lp-1',
      source: 'internal',
      scanStatus: 'pending',
      lastScanJobId: null,
      lastScannedAt: null,
      scores: {},
      createdAt: now,
      updatedAt: now,
    })

    const dto = mapSeoProjectPageToDto(page, project, '7')

    expect(dto).toMatchObject({
      id: 'page-1',
      organizationId: '7',
      aiSeoProjectId: 'project-1',
      projectId: 'project-1',
      websitePageId: 'lp-1',
      pageUrl: 'https://example.com/landing',
      pageType: 'landing_page',
      source: 'internal',
      scanStatus: 'pending',
      technicalScore: 0,
      uxScore: 0,
      authorityScore: 0,
      contentScore: 0,
      graderScore: 0,
    })
  })

  it('uses the landing page title when the builder row is missing', () => {
    expect(linkedPageDisplayName({
      builderName: null,
      projectName: 'Khuyến mãi Tết',
      projectHostname: 'tet.example.com',
      websitePageId: 'lp-1',
      landingPageId: 'lp-1',
    })).toBe('Khuyến mãi Tết')

    expect(linkedPageDisplayName({
      builderName: 'Tên builder',
      projectName: 'Khuyến mãi Tết',
      projectHostname: 'tet.example.com',
      websitePageId: 'lp-1',
      landingPageId: 'lp-1',
    })).toBe('Tên builder')
  })
})