import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { PageEntity } from '../../publish/entities'
import { SeoProjectEntity, SeoProjectPageEntity } from '../entities'
import { AiSeoProjectService } from './ai-seo-project.service'
import { AiSeoPublishService } from './ai-seo-publish.service'
import { AiSeoTrafficService } from './ai-seo-traffic.service'

/**
 * Private-data / multi-tenant isolation for auto + manual AI-SEO publish paths.
 */
describe('AI-SEO private data isolation', () => {
  const tenantA = 10
  const tenantB = 20

  function buildPublishService(tenantId: number, deps: {
    projects: SeoProjectEntity[]
    pages: SeoProjectPageEntity[]
  }) {
    const projectRepository = {
      findOne: jest.fn().mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
        const where = (opts?.where ?? {}) as {
          tenantId?: number
          id?: string
          landingPageId?: string
          hostname?: string
        }
        return (
          deps.projects.find((p) => {
            if (where.tenantId != null && p.tenantId !== where.tenantId) return false
            if (where.id != null && p.id !== where.id) return false
            if (where.landingPageId != null && p.landingPageId !== where.landingPageId) return false
            if (where.hostname != null && p.hostname !== where.hostname) return false
            return true
          }) ?? null
        )
      }),
      save: jest.fn().mockImplementation(async (entity: SeoProjectEntity) => {
        const idx = deps.projects.findIndex((p) => p.id === entity.id)
        if (idx >= 0) deps.projects[idx] = entity
        else deps.projects.push(entity)
        return entity
      }),
    }

    const projectPageRepository = {
      findOne: jest.fn().mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
        const where = (opts?.where ?? {}) as {
          tenantId?: number
          seoProjectId?: string
          websitePageId?: string
        }
        return (
          deps.pages.find(
            (p) =>
              (where.tenantId == null || p.tenantId === where.tenantId)
              && (where.seoProjectId == null || p.seoProjectId === where.seoProjectId)
              && (where.websitePageId == null || p.websitePageId === where.websitePageId),
          ) ?? null
        )
      }),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation(async (entity: SeoProjectPageEntity) => {
        deps.pages.push(entity)
        return entity
      }),
    }

    const builderPageRepository = {
      findOne: jest.fn().mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
        const where = (opts?.where ?? {}) as { tenantId?: number; externalId?: string }
        if (where.tenantId === tenantA && where.externalId === 'page-a') {
          return { externalId: 'page-a', tenantId: tenantA, pageUrl: 'https://a.example' } as PageEntity
        }
        if (where.tenantId === tenantB && where.externalId === 'page-b') {
          return { externalId: 'page-b', tenantId: tenantB, pageUrl: 'https://b.example' } as PageEntity
        }
        return null
      }),
    }

    const projectService = {
      ensureForLandingPage: jest.fn().mockImplementation(async (landingPageId: string) => {
        const found = deps.projects.find(
          (p) => p.tenantId === tenantId && p.landingPageId === landingPageId,
        )
        if (found) return { id: found.id }
        const created = {
          id: `seo-${tenantId}-${landingPageId}`,
          tenantId,
          landingPageId,
          hostname: `${landingPageId}.test`,
        } as SeoProjectEntity
        deps.projects.push(created)
        return { id: created.id }
      }),
    }

    const trafficService = {
      buildScriptTag: jest.fn().mockReturnValue('<script data-website-id="w"></script>'),
      provisionForProject: jest.fn().mockResolvedValue({ status: 'ok', umamiWebsiteId: 'w' }),
    }

    const tenantContext = {
      getTenantId: () => tenantId,
    } as unknown as TenantContextService

    return new AiSeoPublishService(
      tenantContext,
      projectRepository as unknown as Repository<SeoProjectEntity>,
      projectPageRepository as unknown as Repository<SeoProjectPageEntity>,
      builderPageRepository as unknown as Repository<PageEntity>,
      projectService as unknown as AiSeoProjectService,
      trafficService as unknown as AiSeoTrafficService,
    )
  }

  it('tenant A auto-link does not create rows for tenant B project', async () => {
    const store = {
      projects: [
        {
          id: 'seo-b',
          tenantId: tenantB,
          landingPageId: 'page-b',
          hostname: 'b.example',
        } as SeoProjectEntity,
      ],
      pages: [] as SeoProjectPageEntity[],
    }

    const serviceA = buildPublishService(tenantA, store)
    const linked = await serviceA.autoLinkLandingPage('seo-b', 'page-a')
    expect(linked).toBe(false)
    expect(store.pages).toHaveLength(0)
  })

  it('tenant A afterPublish only writes project_page with tenant A', async () => {
    const store = {
      projects: [] as SeoProjectEntity[],
      pages: [] as SeoProjectPageEntity[],
    }
    const serviceA = buildPublishService(tenantA, store)
    const result = await serviceA.afterPublish('page-a')
    expect(result.seoSyncStatus).toBe('ok')
    expect(result.linked).toBe(true)
    expect(store.pages).toHaveLength(1)
    expect(store.pages[0].tenantId).toBe(tenantA)
    expect(store.pages[0].websitePageId).toBe('page-a')
    expect(store.projects.every((p) => p.tenantId === tenantA)).toBe(true)
  })

  it('tenant B cannot resolve tenant A linked project', async () => {
    const store = {
      projects: [
        {
          id: 'seo-a',
          tenantId: tenantA,
          landingPageId: 'page-a',
          hostname: 'a.example',
          umamiWebsiteId: 'w-a',
        } as SeoProjectEntity,
      ],
      pages: [
        {
          tenantId: tenantA,
          seoProjectId: 'seo-a',
          websitePageId: 'page-a',
          pageUrl: 'https://a.example',
        } as SeoProjectPageEntity,
      ],
    }

    const serviceB = buildPublishService(tenantB, store)
    const found = await serviceB.findLinkedProjectForLandingPage('page-a')
    expect(found).toBeNull()
  })

  it('manual project reuse by hostname stays within tenant only', async () => {
    // Documented via ensureForLandingPage: hostname match filters tenantId
    // Here we assert publish service never returns other tenant's project id via findLinked
    const store = {
      projects: [
        {
          id: 'seo-same-host-a',
          tenantId: tenantA,
          landingPageId: null,
          hostname: 'shared-name.example',
        } as unknown as SeoProjectEntity,
        {
          id: 'seo-same-host-b',
          tenantId: tenantB,
          landingPageId: null,
          hostname: 'shared-name.example',
        } as unknown as SeoProjectEntity,
      ],
      pages: [] as SeoProjectPageEntity[],
    }

    const serviceA = buildPublishService(tenantA, store)
    const linkedA = await serviceA.findLinkedProjectForLandingPage('no-link-yet')
    expect(linkedA).toBeNull()

    // After linking only tenant A project
    store.projects[0].landingPageId = 'page-a' as unknown as string
    const again = await serviceA.findLinkedProjectForLandingPage('page-a')
    expect(again?.id).toBe('seo-same-host-a')
    expect(again?.tenantId).toBe(tenantA)
  })
})
