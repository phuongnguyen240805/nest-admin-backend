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
  let projectPageRepository: jest.Mocked<Pick<Repository<SeoProjectPageEntity>, 'findOne'>>
  let builderPageRepository: jest.Mocked<Pick<Repository<PageEntity>, 'findOne'>>
  let projectService: jest.Mocked<Pick<AiSeoProjectService, 'ensureForLandingPage'>>
  let trafficService: jest.Mocked<Pick<AiSeoTrafficService, 'buildScriptTag' | 'provisionForProject'>>
  let service: AiSeoPublishService

  beforeEach(() => {
    project = {
      id: projectId,
      tenantId,
      landingPageId: pageId,
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
      findOne: jest.fn().mockResolvedValue(null),
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

  it('afterPublish ensures project and provisions umami soft', async () => {
    const result = await service.afterPublish(pageId)
    expect(result.seoSyncStatus).toBe('ok')
    expect(result.seoProjectId).toBe(projectId)
    expect(projectService.ensureForLandingPage).toHaveBeenCalledWith(pageId, undefined)
    expect(trafficService.provisionForProject).toHaveBeenCalledWith(projectId)
  })

  it('afterPublish soft-fails without throwing', async () => {
    projectService.ensureForLandingPage.mockRejectedValueOnce(new Error('boom'))
    const result = await service.afterPublish(pageId)
    expect(result.seoSyncStatus).toBe('failed')
    expect(result.seoProjectId).toBeNull()
  })
})
