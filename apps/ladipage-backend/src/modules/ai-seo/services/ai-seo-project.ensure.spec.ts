import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { PageEntity } from '../../publish/entities'
import { SeoProjectEntity, SeoProjectPageEntity, SeoTaskEntity } from '../entities'
import { AiSeoProjectService } from './ai-seo-project.service'
import { AiSeoQuotaService } from './ai-seo-quota.service'
import { AiSeoTrafficService } from './ai-seo-traffic.service'
import { OpenSeoClientService } from './openseo-client.service'

describe('AiSeoProjectService.ensureForLandingPage', () => {
  const tenantId = 7
  let projects: SeoProjectEntity[]
  let seq = 0
  let service: AiSeoProjectService

  beforeEach(() => {
    projects = []
    seq = 0
    const projectRepository = {
      findOne: jest.fn().mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
        const where = opts?.where ?? {}
        return projects.find((project) => {
          if (where.tenantId != null && project.tenantId !== where.tenantId) return false
          if (where.id != null && project.id !== where.id) return false
          if (where.landingPageId != null && project.landingPageId !== where.landingPageId) return false
          if (where.hostname != null && project.hostname !== where.hostname) return false
          return true
        }) ?? null
      }),
      create: jest.fn().mockImplementation((data: Partial<SeoProjectEntity>) => data),
      save: jest.fn().mockImplementation(async (entity: SeoProjectEntity) => {
        if (!entity.id) entity.id = `seo-${++seq}`
        const index = projects.findIndex((project) => project.id === entity.id)
        if (index >= 0) projects[index] = entity
        else projects.push(entity)
        return entity
      }),
    }
    const openSeoClient = {
      createProject: jest.fn().mockResolvedValue({ id: 'remote-1' }),
    }
    const trafficService = {
      provisionForProject: jest.fn().mockResolvedValue({ status: 'ok', umamiWebsiteId: 'web-1' }),
    }

    service = new AiSeoProjectService(
      { getTenantId: () => tenantId } as unknown as TenantContextService,
      projectRepository as unknown as Repository<SeoProjectEntity>,
      {} as Repository<SeoTaskEntity>,
      {} as Repository<SeoProjectPageEntity>,
      undefined as unknown as Repository<PageEntity>,
      openSeoClient as unknown as OpenSeoClientService,
      {} as AiSeoQuotaService,
      trafficService as unknown as AiSeoTrafficService,
    )
  })

  function seed(partial: Partial<SeoProjectEntity>): SeoProjectEntity {
    const project = {
      id: `seo-${++seq}`,
      tenantId,
      landingPageId: null,
      hostname: 'tet.example.com',
      name: 'tet.example.com',
      slug: 'tet-example-com',
      status: 'active',
      taskStatus: 'pending',
      pixelTagState: 'not_installed',
      isFavorite: false,
      isEngaged: true,
      holisticScores: {},
      connectedData: {},
      siteAudit: {},
      umamiWebsiteId: 'web-1',
      trafficScriptState: 'not_installed',
      trafficSnapshot: {},
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...partial,
    } as SeoProjectEntity
    projects.push(project)
    return project
  }

  it('renames an existing project to the published landing page title', async () => {
    seed({ landingPageId: 'page-1', name: 'tet.example.com' })

    const dto = await service.ensureForLandingPage('page-1', {
      hostname: 'tet.example.com',
      name: 'Khuyến mãi Tết',
      slug: 'khuyen-mai-tet',
    })

    expect(dto.name).toBe('Khuyến mãi Tết')
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe('Khuyến mãi Tết')
  })

  it('creates a separate project when the hostname already belongs to another page', async () => {
    seed({ landingPageId: 'page-1', name: 'Trang cũ' })

    const dto = await service.ensureForLandingPage('page-2', {
      hostname: 'tet.example.com',
      publicUrl: 'https://tet.example.com',
      name: 'Trang mới',
      slug: 'trang-moi',
    })

    expect(dto.name).toBe('Trang mới')
    expect(projects).toHaveLength(2)
    expect(projects.find((project) => project.landingPageId === 'page-2')?.name).toBe('Trang mới')
    expect(projects.find((project) => project.landingPageId === 'page-1')?.name).toBe('Trang cũ')
  })
})
