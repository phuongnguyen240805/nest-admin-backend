import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { SeoProjectEntity, SeoProjectPageEntity, SeoTaskEntity } from '../entities'
import { LabScanService } from './lab-scan.service'
import { UnlighthouseRunner } from './unlighthouse.runner'
import type { NormalizedLabResult } from '../utils/unlighthouse.normalizer'

describe('LabScanService tenant isolation', () => {
  const tenantA = 1
  const tenantB = 2
  const projectA = 'proj-a'
  const pageA = 'page-a'

  let projects: SeoProjectEntity[]
  let pages: SeoProjectPageEntity[]
  let tasks: SeoTaskEntity[]
  let tenantId: number
  let service: LabScanService
  let runner: jest.Mocked<Pick<UnlighthouseRunner, 'run' | 'shouldMock'>>

  beforeEach(() => {
    tenantId = tenantA
    projects = [
      { id: projectA, tenantId: tenantA, siteAudit: {}, holisticScores: {} } as SeoProjectEntity,
      { id: 'proj-b', tenantId: tenantB, siteAudit: {}, holisticScores: {} } as SeoProjectEntity,
    ]
    pages = [
      {
        id: pageA,
        tenantId: tenantA,
        seoProjectId: projectA,
        pageUrl: 'https://a.example.com/lp',
        websitePageId: 'wp-a',
        scores: {},
        scanStatus: 'pending',
      } as SeoProjectPageEntity,
      {
        id: 'page-b',
        tenantId: tenantB,
        seoProjectId: 'proj-b',
        pageUrl: 'https://b.example.com/lp',
        websitePageId: 'wp-b',
        scores: {},
        scanStatus: 'pending',
      } as SeoProjectPageEntity,
    ]
    tasks = []

    const projectRepository = {
      findOne: jest.fn(async (opts: { where: Record<string, unknown> }) => {
        const w = opts.where
        return (
          projects.find(
            (p) =>
              p.id === w.id &&
              (w.tenantId == null || p.tenantId === w.tenantId),
          ) ?? null
        )
      }),
      save: jest.fn(async (e) => e),
    }

    const pageRepository = {
      findOne: jest.fn(async (opts: { where: Record<string, unknown> }) => {
        const w = opts.where
        return (
          pages.find(
            (p) =>
              (w.id == null || p.id === w.id) &&
              (w.tenantId == null || p.tenantId === w.tenantId) &&
              (w.seoProjectId == null || p.seoProjectId === w.seoProjectId),
          ) ?? null
        )
      }),
      update: jest.fn(async () => undefined),
      save: jest.fn(async (e) => e),
    }

    const taskRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (entity) => {
        const row = { id: `task-${tasks.length + 1}`, ...entity } as SeoTaskEntity
        tasks.push(row)
        return row
      }),
      findOne: jest.fn(async (opts: { where: Record<string, unknown> }) => {
        const w = opts.where
        return (
          tasks.find(
            (t) =>
              (w.externalTaskId == null || t.externalTaskId === w.externalTaskId) &&
              (w.seoProjectId == null || t.seoProjectId === w.seoProjectId),
          ) ?? null
        )
      }),
      createQueryBuilder: jest.fn(() => {
        let jobIdFilter: string | undefined
        let tenantFilter: number | undefined
        const qb = {
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockImplementation((clause: string, params?: Record<string, unknown>) => {
            if (params?.jobId) jobIdFilter = String(params.jobId)
            if (params?.tenantId != null) tenantFilter = Number(params.tenantId)
            return qb
          }),
          andWhere: jest.fn().mockImplementation((clause: string, params?: Record<string, unknown>) => {
            if (params?.jobId) jobIdFilter = String(params.jobId)
            if (params?.tenantId != null) tenantFilter = Number(params.tenantId)
            return qb
          }),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          getOne: jest.fn(async () => {
            const task = tasks.find((t) => t.externalTaskId === jobIdFilter)
            if (!task) return null
            const project = projects.find((p) => p.id === task.seoProjectId)
            if (!project || (tenantFilter != null && project.tenantId !== tenantFilter)) {
              return null
            }
            return task
          }),
        }
        return qb
      }),
    }

    runner = {
      shouldMock: jest.fn().mockReturnValue(true),
      run: jest.fn(async (payload) => {
        const lab: NormalizedLabResult = {
          version: 1,
          source: 'unlighthouse',
          mock: true,
          lighthouseVersion: 'mock',
          fetchedAt: new Date().toISOString(),
          pages: [
            {
              url: payload.targetUrl,
              finalUrl: payload.targetUrl,
              device: 'mobile',
              scores: {
                performance: 70,
                accessibility: 90,
                'best-practices': 85,
                seo: 88,
              },
              metrics: {
                largestContentfulPaint: { numericValue: 2000, displayValue: null },
                cumulativeLayoutShift: { numericValue: 0.01, displayValue: null },
                totalBlockingTime: { numericValue: 150, displayValue: null },
                firstContentfulPaint: { numericValue: 1000, displayValue: null },
                speedIndex: { numericValue: 2200, displayValue: null },
                serverResponseTime: { numericValue: 200, displayValue: null },
              },
              issues: [],
            },
          ],
          aggregate: {
            pagesScanned: 1,
            pagesFailed: 0,
            avgPerformance: 70,
            worstPages: [],
          },
        }
        return lab
      }),
    }

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'UNLIGHTHOUSE_MODE') return 'mock'
        if (key === 'UNLIGHTHOUSE_INLINE') return 'true'
        if (key === 'UNLIGHTHOUSE_COOLDOWN_MS') return '0'
        return undefined
      }),
    } as unknown as ConfigService

    const tenantContext = {
      getTenantId: () => tenantId,
    } as unknown as TenantContextService

    service = new LabScanService(
      tenantContext,
      configService,
      runner as unknown as UnlighthouseRunner,
      undefined,
      projectRepository as unknown as Repository<SeoProjectEntity>,
      pageRepository as unknown as Repository<SeoProjectPageEntity>,
      taskRepository as unknown as Repository<SeoTaskEntity>,
      undefined,
    )
  })

  it('starts lab scan for tenant A page and stores lighthouse scores', async () => {
    const result = await service.startLabScan({
      trigger: 'editor',
      seoProjectId: projectA,
      seoProjectPageId: pageA,
      mock: true,
    })
    expect(result.jobId.startsWith('lab-')).toBe(true)
    expect(result.status).toBe('success')
    expect(runner.run).toHaveBeenCalled()
    expect(tasks.some((t) => t.externalTaskId === result.jobId)).toBe(true)
    const project = projects.find((p) => p.id === projectA)!
    expect((project.siteAudit as { lighthouse?: unknown }).lighthouse).toBeDefined()
  })

  it('marks lab scan failed when Unlighthouse returns no scores', async () => {
    runner.run.mockResolvedValueOnce({
      version: 1,
      source: 'unlighthouse',
      mock: false,
      lighthouseVersion: null,
      fetchedAt: new Date().toISOString(),
      pages: [
        {
          url: 'https://a.example.com/lp',
          finalUrl: 'https://a.example.com/lp',
          device: 'mobile',
          scores: {
            performance: null,
            accessibility: null,
            'best-practices': null,
            seo: null,
          },
          metrics: {
            largestContentfulPaint: { numericValue: null, displayValue: null },
            cumulativeLayoutShift: { numericValue: null, displayValue: null },
            totalBlockingTime: { numericValue: null, displayValue: null },
            firstContentfulPaint: { numericValue: null, displayValue: null },
            speedIndex: { numericValue: null, displayValue: null },
            serverResponseTime: { numericValue: null, displayValue: null },
          },
          issues: [],
        },
      ],
      aggregate: {
        pagesScanned: 1,
        pagesFailed: 1,
        avgPerformance: null,
        worstPages: [],
      },
    })

    const result = await service.startLabScan({
      trigger: 'editor',
      seoProjectId: projectA,
      seoProjectPageId: pageA,
      mock: true,
    })

    expect(result.status).toBe('failed')
    expect((result.result as { errorCode?: string }).errorCode).toBe('no_lighthouse_scores')
    expect((result.result as { lighthouse?: NormalizedLabResult }).lighthouse?.aggregate.pagesFailed).toBe(1)
  })

  it('rejects page belonging to another tenant', async () => {
    await expect(
      service.startLabScan({
        trigger: 'list',
        seoProjectPageId: 'page-b',
        mock: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('rejects reading lab job from another tenant', async () => {
    const created = await service.startLabScan({
      trigger: 'editor',
      seoProjectId: projectA,
      seoProjectPageId: pageA,
      mock: true,
    })
    tenantId = tenantB
    await expect(service.getLabScan(created.jobId)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('rejects missing target URL', async () => {
    pages[0].pageUrl = ''
    await expect(
      service.startLabScan({
        trigger: 'list',
        seoProjectId: projectA,
        seoProjectPageId: pageA,
        mock: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('processPayload refuses tenant mismatch on project', async () => {
    await service.startLabScan({
      trigger: 'editor',
      seoProjectId: projectA,
      seoProjectPageId: pageA,
      mock: true,
    })
    const task = tasks[0]
    await service.processPayload({
      jobId: task.externalTaskId!,
      tenantId: tenantB,
      seoProjectId: projectA,
      seoProjectPageId: pageA,
      websitePageId: null,
      targetUrl: 'https://a.example.com/lp',
      trigger: 'editor',
      phase: 'pre_publish',
      depth: 'quick',
      device: 'mobile',
      samples: 1,
      mock: true,
    })
    expect(task.status).toBe('rejected')
    expect((task.result as { error?: string }).error).toBe('tenant_mismatch')
  })
})
