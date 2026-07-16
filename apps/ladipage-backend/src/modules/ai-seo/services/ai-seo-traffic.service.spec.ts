import { ConfigService } from '@nestjs/config'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { SeoProjectEntity } from '../entities'
import { AiSeoCacheService } from './ai-seo-cache.service'
import { AiSeoTrafficService } from './ai-seo-traffic.service'
import { UmamiClientService, UmamiUnavailableError } from './umami-client.service'

describe('AiSeoTrafficService', () => {
  const tenantId = 42
  const projectId = 'proj-1'

  let project: SeoProjectEntity
  let projectRepository: jest.Mocked<Pick<Repository<SeoProjectEntity>, 'findOne' | 'save'>>
  let umamiClient: jest.Mocked<
    Pick<
      UmamiClientService,
      'isEnabled' | 'getCircuitState' | 'healthCheck' | 'getStats' | 'getMetrics' | 'getPageviews' | 'createWebsite'
    >
  >
  let cache: AiSeoCacheService
  let service: AiSeoTrafficService

  beforeEach(() => {
    project = {
      id: projectId,
      tenantId,
      umamiWebsiteId: 'web-1',
      umamiShareId: null,
      trafficSyncedAt: null,
      trafficSnapshot: {},
      hostname: 'example.com',
      slug: 'example-com',
    } as SeoProjectEntity

    projectRepository = {
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        if (where.tenantId === tenantId && where.id === projectId) return project
        return null
      }),
      save: jest.fn().mockImplementation(async (entity) => entity),
    }

    umamiClient = {
      isEnabled: jest.fn().mockReturnValue(true),
      getCircuitState: jest.fn().mockReturnValue('closed'),
      healthCheck: jest.fn().mockResolvedValue({ ok: true, circuit: 'closed' }),
      getStats: jest.fn().mockResolvedValue({
        pageviews: 12,
        visitors: 5,
        visits: 6,
        bounces: 1,
        totaltime: 90,
      }),
      getMetrics: jest.fn().mockResolvedValue([{ x: 'google', y: 3 }]),
      getPageviews: jest.fn().mockResolvedValue([{ x: '2026-07-01', y: 2 }]),
      createWebsite: jest.fn().mockResolvedValue({ id: 'web-new', name: 'n', domain: 'd' }),
    }

    cache = new AiSeoCacheService()

    const tenantContext = {
      getTenantId: () => tenantId,
    } as unknown as TenantContextService

    const config = {
      get: (key: string) => {
        if (key === 'UMAMI_CACHE_TTL_SECONDS') return '300'
        if (key === 'UMAMI_CACHE_STALE_TTL_SECONDS') return '3600'
        return undefined
      },
    } as unknown as ConfigService

    service = new AiSeoTrafficService(
      tenantContext,
      projectRepository as unknown as Repository<SeoProjectEntity>,
      umamiClient as unknown as UmamiClientService,
      cache,
      config,
    )
  })

  it('returns disabled when Umami is off', async () => {
    umamiClient.isEnabled.mockReturnValue(false)
    const result = await service.getProjectTraffic(projectId)
    expect(result.status).toBe('disabled')
    expect(umamiClient.getStats).not.toHaveBeenCalled()
  })

  it('returns not_configured when project has no website id', async () => {
    project.umamiWebsiteId = null
    const result = await service.getProjectTraffic(projectId)
    expect(result.status).toBe('not_configured')
    expect(umamiClient.getStats).not.toHaveBeenCalled()
  })

  it('returns ok stats for tenant project', async () => {
    const result = await service.getProjectTraffic(projectId, '7d')
    expect(result.status).toBe('ok')
    expect(result.data).toEqual(expect.objectContaining({ pageviews: 12, visitors: 5 }))
    expect(umamiClient.getStats).toHaveBeenCalledWith('web-1', expect.any(Object))
  })

  it('returns degraded with stale cache when Umami fails', async () => {
    await service.getProjectTraffic(projectId)
    const liveKey = `umami:t${tenantId}:p${projectId}:stats:7d`
    // Expire live cache; keep stale key populated by first success
    cache.set(liveKey, { pageviews: 0 }, 0)
    umamiClient.getStats.mockRejectedValueOnce(new UmamiUnavailableError('down'))

    const result = await service.getProjectTraffic(projectId)
    expect(result.status).toBe('degraded')
    expect(result.stale).toBe(true)
    expect(result.data).toEqual(expect.objectContaining({ pageviews: 12 }))
  })

  it('404-equivalent: other tenant project not found', async () => {
    projectRepository.findOne.mockResolvedValue(null)
    await expect(service.getProjectTraffic(projectId)).rejects.toThrow('SEO project not found')
    expect(umamiClient.getStats).not.toHaveBeenCalled()
  })

  it('provisions website and saves umamiWebsiteId', async () => {
    project.umamiWebsiteId = null
    const result = await service.provisionForProject(projectId)
    expect(result.status).toBe('ok')
    expect(result.umamiWebsiteId).toBe('web-new')
    expect(projectRepository.save).toHaveBeenCalled()
  })
})
