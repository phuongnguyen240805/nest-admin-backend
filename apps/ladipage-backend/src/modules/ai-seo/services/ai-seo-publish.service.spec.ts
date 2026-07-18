import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { PageEntity } from '../../publish/entities'
import { SeoProjectEntity, SeoProjectPageEntity } from '../entities'
import { AiSeoProjectService } from './ai-seo-project.service'
import { AiSeoPublishService } from './ai-seo-publish.service'
import { AiSeoTrafficService } from './ai-seo-traffic.service'

describe('AiSeoPublishService', () => {
  const tenantId = 7
  const otherTenantId = 9
  const pageId = 'page-1'
  const projectId = 'seo-1'

  let project: SeoProjectEntity
  let projectRepository: jest.Mocked<Pick<Repository<SeoProjectEntity>, 'findOne' | 'save'>>
  let projectPageRepository: jest.Mocked<
    Pick<Repository<SeoProjectPageEntity>, 'findOne' | 'save' | 'create'>
  >
  let builderPageRepository: jest.Mocked<Pick<Repository<PageEntity>, 'findOne'>>
  let projectService: jest.Mocked<Pick<AiSeoProjectService, 'ensureForLandingPage'>>
  let trafficService: jest.Mocked<Pick<AiSeoTrafficService, 'buildScriptTag' | 'provisionForProject'>>
  let service: AiSeoPublishService
  let projectPages: SeoProjectPageEntity[]

  beforeEach(() => {
    projectPages = []
    project = {
      id: projectId,
      tenantId,
      landingPageId: pageId,
      hostname: 'example.com',
      umamiWebsiteId: 'web-1',
      pixelTagState: 'not_installed',
      trafficScriptState: 'not_installed',
    } as SeoProjectEntity

    projectRepository = {
      findOne: jest.fn().mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
        const where = (opts?.where ?? {}) as {
          tenantId?: number
          id?: string
          landingPageId?: string
        }
        if (
          where.tenantId === tenantId
          && (where.id === projectId || where.landingPageId === pageId)
        ) {
          return project
        }
        return null
      }),
      save: jest.fn().mockImplementation(async (entity) => entity),
    }

    projectPageRepository = {
      findOne: jest.fn().mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
        const where = (opts?.where ?? {}) as {
          tenantId?: number
          seoProjectId?: string
          websitePageId?: string
        }
        return (
          projectPages.find(
            (p) =>
              p.tenantId === where.tenantId
              && p.seoProjectId === where.seoProjectId
              && p.websitePageId === where.websitePageId,
          ) ?? null
        )
      }),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation(async (entity) => {
        projectPages.push(entity as SeoProjectPageEntity)
        return entity
      }),
    }

    builderPageRepository = {
      findOne: jest.fn().mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
        const where = (opts?.where ?? {}) as { tenantId?: number; externalId?: string }
        if (where.tenantId === tenantId && where.externalId === pageId) {
          return { externalId: pageId, tenantId } as PageEntity
        }
        return null
      }),
    }

    projectService = {
      ensureForLandingPage: jest.fn().mockResolvedValue({ id: projectId }),
    }

    trafficService = {
      buildScriptTag: jest.fn().mockReturnValue('<script defer src="http://localhost:3002/script.js" data-website-id="web-1"></script>'),
      provisionForProject: jest.fn().mockResolvedValue({ status: 'ok', umamiWebsiteId: 'web-1' }),
    }

    const tenantContext = {
      getTenantId: () => tenantId,
    } as unknown as TenantContextService

    service = new AiSeoPublishService(
      tenantContext,
      projectRepository as unknown as Repository<SeoProjectEntity>,
      projectPageRepository as unknown as Repository<SeoProjectPageEntity>,
      builderPageRepository as unknown as Repository<PageEntity>,
      projectService as unknown as AiSeoProjectService,
      trafficService as unknown as AiSeoTrafficService,
    )
  })

  it('skips inject when no SEO project linked for tenant', async () => {
    projectRepository.findOne.mockResolvedValue(null)
    const html = '<html><head></head></html>'
    const result = await service.preparePublishedHtml(pageId, html)
    expect(result.seoSyncStatus).toBe('skipped')
    expect(result.html).toBe(html)
    expect(result.scriptsInjected.seoPixel).toBe(false)
  })

  it('injects seo pixel and umami for linked project', async () => {
    const html = '<html><head><title>x</title></head><body></body></html>'
    const result = await service.preparePublishedHtml(pageId, html)
    expect(result.seoSyncStatus).toBe('ok')
    expect(result.seoProjectId).toBe(projectId)
    expect(result.html).toContain('data-liora-ai-seo-project="seo-1"')
    expect(result.html).toContain('data-website-id="web-1"')
    expect(result.scriptsInjected.seoPixel).toBe(true)
    expect(result.scriptsInjected.umami).toBe(true)
  })

  it('does not inject twice (idempotent)', async () => {
    const first = await service.preparePublishedHtml(
      pageId,
      '<html><head></head></html>',
    )
    const second = await service.preparePublishedHtml(pageId, first.html)
    const pixelCount = (second.html ?? '').split('data-liora-ai-seo-project="seo-1"').length - 1
    expect(pixelCount).toBe(1)
  })

  it('isolation: linked project lookup is tenant-scoped (other tenant not returned)', async () => {
    project.tenantId = otherTenantId
    projectRepository.findOne.mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
      const where = (opts?.where ?? {}) as { tenantId?: number }
      if (where.tenantId === tenantId) return null
      return project
    })
    const result = await service.preparePublishedHtml(pageId, '<html><head></head></html>')
    expect(result.seoSyncStatus).toBe('skipped')
    expect(result.seoProjectId).toBeNull()
  })

  it('afterPublish ensures project, auto-links page, and provisions umami soft', async () => {
    const result = await service.afterPublish(pageId)
    expect(result.seoSyncStatus).toBe('ok')
    expect(result.seoProjectId).toBe(projectId)
    expect(result.linked).toBe(true)
    expect(projectService.ensureForLandingPage).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({ storeId: undefined }),
    )
    expect(trafficService.provisionForProject).toHaveBeenCalledWith(projectId)
    expect(projectPageRepository.save).toHaveBeenCalled()
    expect(projectPages[0]?.tenantId).toBe(tenantId)
    expect(projectPages[0]?.websitePageId).toBe(pageId)
  })

  it('afterPublish auto-link is idempotent (second call linked=false)', async () => {
    await service.afterPublish(pageId)
    const second = await service.afterPublish(pageId)
    expect(second.linked).toBe(false)
    expect(projectPages).toHaveLength(1)
  })

  it('autoLink isolation: refuses project id from another tenant', async () => {
    projectRepository.findOne.mockResolvedValue(null)
    const linked = await service.autoLinkLandingPage('foreign-project', pageId)
    expect(linked).toBe(false)
    expect(projectPageRepository.save).not.toHaveBeenCalled()
  })

  it('afterPublish soft-fails without throwing', async () => {
    projectService.ensureForLandingPage.mockRejectedValueOnce(new Error('boom'))
    const result = await service.afterPublish(pageId)
    expect(result.seoSyncStatus).toBe('failed')
    expect(result.seoProjectId).toBeNull()
    expect(result.linked).toBe(false)
  })
})
