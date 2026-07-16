import { NotFoundException } from '@nestjs/common'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { AiSeoPublishService } from '../ai-seo/services/ai-seo-publish.service'
import { PageEntity } from './entities'
import { PublishService } from './publish.service'

describe('PublishService.completeLandingPublish', () => {
  const tenantId = 3
  const pageId = 'lp-1'

  let page: PageEntity
  let pageRepository: jest.Mocked<Pick<Repository<PageEntity>, 'findOne' | 'save'>>
  let aiSeoPublish: jest.Mocked<
    Pick<AiSeoPublishService, 'preparePublishedHtml' | 'afterPublish'>
  >
  let service: PublishService

  beforeEach(() => {
    page = {
      externalId: pageId,
      tenantId,
      isPublish: false,
      pageUrl: 'https://example.com/p/x',
      alias: 'x',
      storeId: 'store-1',
    } as PageEntity

    pageRepository = {
      findOne: jest.fn().mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
        const where = (opts?.where ?? {}) as { tenantId?: number; externalId?: string }
        if (where.tenantId === tenantId && where.externalId === pageId) return page
        return null
      }),
      save: jest.fn().mockImplementation(async (entity) => entity),
    }

    aiSeoPublish = {
      preparePublishedHtml: jest.fn().mockResolvedValue({
        html: '<html><head><script data-liora-ai-seo-project="s1"></script></head></html>',
        seoProjectId: 's1',
        seoSyncStatus: 'ok',
        trafficSyncStatus: 'ok',
        scriptsInjected: { seoPixel: true, umami: true },
      }),
      afterPublish: jest.fn().mockResolvedValue({
        seoProjectId: 's1',
        seoSyncStatus: 'ok',
        trafficSyncStatus: 'ok',
      }),
    }

    const tenantContext = {
      getTenantId: () => tenantId,
    } as unknown as TenantContextService

    service = new PublishService(
      tenantContext,
      pageRepository as unknown as Repository<PageEntity>,
      aiSeoPublish as unknown as AiSeoPublishService,
    )
  })

  it('marks page published and returns seo sync metadata', async () => {
    const result = await service.completeLandingPublish({
      pageId,
      html: '<html><head></head></html>',
    })

    expect(result.published).toBe(true)
    expect(result.seoProjectId).toBe('s1')
    expect(result.scriptsInjected.seoPixel).toBe(true)
    expect(page.isPublish).toBe(true)
    expect(pageRepository.save).toHaveBeenCalled()
    expect(aiSeoPublish.afterPublish).toHaveBeenCalledWith(pageId, undefined)
  })

  it('isolation: does not publish page belonging to another tenant', async () => {
    pageRepository.findOne.mockResolvedValue(null)
    const result = await service.completeLandingPublish({ pageId: 'foreign' })
    expect(result.published).toBe(false)
    expect(pageRepository.save).not.toHaveBeenCalled()
  })

  it('unpublish only affects tenant page', async () => {
    page.isPublish = true
    const result = await service.unpublishLandingPage(pageId)
    expect(result.published).toBe(false)
    expect(page.isPublish).toBe(false)
  })

  it('unpublish throws when page not in tenant', async () => {
    pageRepository.findOne.mockResolvedValue(null)
    await expect(service.unpublishLandingPage('missing')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('continues when AI-SEO prepare reports failed (fail-soft)', async () => {
    aiSeoPublish.preparePublishedHtml.mockResolvedValue({
      html: '<html></html>',
      seoProjectId: null,
      seoSyncStatus: 'failed',
      trafficSyncStatus: 'failed',
      scriptsInjected: { seoPixel: false, umami: false },
      message: 'down',
    })
    aiSeoPublish.afterPublish.mockResolvedValue({
      seoProjectId: null,
      seoSyncStatus: 'failed',
      trafficSyncStatus: 'failed',
    })

    const result = await service.completeLandingPublish({ pageId, html: '<html></html>' })
    expect(result.published).toBe(true)
    expect(result.seoSyncStatus).toBe('failed')
  })
})
