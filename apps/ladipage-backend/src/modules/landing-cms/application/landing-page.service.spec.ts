import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common'

import { LandingPageService } from './landing-page.service'
import { PageRegistryStore } from './page-registry.store'
import { signBridgePayload } from '../instatic/instatic-hmac'

jest.mock(
  '@liora/nest-core/modules/tenant/organization-provisioning.service',
  () => ({ OrganizationProvisioningService: class OrganizationProvisioningService {} }),
)
jest.mock(
  '@liora/nest-core/modules/tenant/tenant-context.service',
  () => ({ TenantContextService: class TenantContextService {} }),
)
jest.mock(
  '../../ai-seo/services/ai-seo-publish.service',
  () => ({ AiSeoPublishService: class AiSeoPublishService {} }),
)

describe('LandingPageService', () => {
  const config = {
    mock: true,
    baseUrl: 'http://127.0.0.1:8787',
    adminToken: '',
    ssoSecret: 'sso-secret',
    bridgeHmacSecret: 'bridge-secret',
    publicCmsPrefix: '/_cms',
    sessionTtlSeconds: 3600,
    publicEditorOrigin: 'http://localhost:3000',
    publishSource: 'instatic-artifact',
  }

  const client = {
    isMock: true,
    health: jest.fn().mockResolvedValue({ ok: true, version: 'mock' }),
    ensurePage: jest.fn().mockResolvedValue({ siteId: 'site_ws_7', pageId: 'page_p1' }),
    importHtml: jest.fn().mockResolvedValue({ siteId: 'site_ws_7', pageId: 'page_p1' }),
    fetchPublishedArtifact: jest.fn().mockResolvedValue({
      html: '<html><body>ok</body></html>',
      title: 'T',
      description: 'D',
      etag: 'e1',
    }),
  }

  function createService(aiSeoAutomation?: {
    tenantContext: { setContext: jest.Mock }
    organizationProvisioning: { ensureWorkspaceForUser: jest.Mock }
    aiSeoPublishService: {
      afterPublish: jest.Mock
      preparePublishedHtml: jest.Mock
    }
  }) {
    const supabaseService = {
      hasAdminClient: () => false,
      getAdminClient: () => {
        throw new Error('no admin')
      },
    }
    const registry = new PageRegistryStore(supabaseService as never)
    const sso = {
      mint: jest.fn().mockImplementation((input: {
        pageId: string
        externalSiteId: string
        externalPageId: string
      }) => ({
        sessionToken: 'tok',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        cmsPath: `/admin/api/cms/auth/ladipage-sso?token=tok`,
        editorUrl: `/admin/api/cms/auth/ladipage-sso?token=tok`,
      })),
      verify: jest.fn(),
    }
    const importService = {
      materialize: jest.fn().mockResolvedValue({ siteId: 'site_ws_7', pageId: 'page_p1' }),
    }
    const artifactService = {
      fetch: jest.fn().mockResolvedValue({
        html: '<html><body>ok</body></html>',
        title: 'T',
        description: 'D',
        etag: 'e1',
      }),
    }

    const service = new LandingPageService(
      config as never,
      registry,
      sso as never,
      importService as never,
      artifactService as never,
      client as never,
      aiSeoAutomation?.tenantContext as never,
      aiSeoAutomation?.organizationProvisioning as never,
      aiSeoAutomation?.aiSeoPublishService as never,
    )

    return { service, registry, sso, importService, artifactService }
  }

  it('opens editor session without calling ensurePage', async () => {
    const { service, sso } = createService()
    const session = await service.openEditorSession('p1', 7)

    expect(session.pageId).toBe('p1')
    expect(session.editPath).toBe('/landing-pages/p1/edit')
    expect(session.cmsPath).toContain('ladipage-sso')
    expect(session.editorUrl).toContain('ladipage-sso')
    expect(session.engine).toBe('instatic')
    expect(sso.mint).toHaveBeenCalled()
    expect(client.ensurePage).not.toHaveBeenCalled()
  })

  it('imports stored html into Instatic before opening a new editor mapping', async () => {
    const { service, registry, importService } = createService()
    jest.spyOn(registry, 'getImportSourceHtml').mockResolvedValue({
      pageId: 'p1',
      name: 'Stored',
      slug: 'stored',
      html: '<html><body><h1>Stored</h1></body></html>',
    })

    const session = await service.openEditorSession('p1', 7)

    expect(session.engine).toBe('instatic')
    expect(importService.materialize).toHaveBeenCalledWith({
      pageId: 'p1',
      workspaceKey: 'ws_7',
      title: 'Stored',
      html: '<html><body><h1>Stored</h1></body></html>',
    })
  })

  it('rejects editor session when another Nest user owns the Instatic mapping', async () => {
    const { service } = createService()
    await service.openEditorSession('p1', 7)

    await expect(service.openEditorSession('p1', 8)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('materializes html into instatic mapping', async () => {
    const { service, importService } = createService()
    const result = await service.materializeFromHtml({
      pageId: 'p1',
      html: '<h1>Hi</h1>',
      name: 'Hello',
      actorUserId: 7,
    })

    expect(result.engine).toBe('instatic')
    expect(result.externalSiteId).toBe('site_ws_7')
    expect(importService.materialize).toHaveBeenCalled()
  })

  it('ignores client supplied workspaceId when materializing html', async () => {
    const { service, importService } = createService()
    await service.materializeFromHtml({
      pageId: 'p1',
      html: '<h1>Hi</h1>',
      workspaceId: 'ws_attacker',
      actorUserId: 7,
    })

    expect(importService.materialize).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceKey: 'ws_7' }),
    )
  })

  it('rejects empty html on materialize', async () => {
    const { service } = createService()
    await expect(
      service.materializeFromHtml({ pageId: 'p1', html: '  ', actorUserId: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('returns artifact after materialize', async () => {
    const { service } = createService()
    await service.materializeFromHtml({
      pageId: 'p1',
      html: '<h1>Hi</h1>',
      actorUserId: 7,
    })
    const artifact = await service.getPublishedArtifact('p1', 7)
    expect(artifact.html).toContain('<html')
    expect(artifact.source).toBe('mock')
  })

  it('accepts publish intent with inline html', async () => {
    const { service, registry } = createService()
    const persist = jest.spyOn(registry, 'persistPublishedArtifact')
    const result = await service.acceptPublishIntent({
      pageId: 'p1',
      html: '<html><body>x</body></html>',
      seoTitle: 'SEO',
    })
    expect(result.accepted).toBe(true)
    expect(result.artifact.meta.title).toBe('SEO')
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'p1',
        html: '<html><body>x</body></html>',
        meta: expect.objectContaining({ title: 'SEO' }),
      }),
    )
  })

  it('creates and links an AI-SEO project when Instatic publishes', async () => {
    const tenantContext = { setContext: jest.fn() }
    const organizationProvisioning = {
      ensureWorkspaceForUser: jest.fn().mockResolvedValue({
        tenantId: 17,
        organizationId: 'org-17',
        appCode: 'ladipage',
        organization: {},
      }),
    }
    const aiSeoPublishService = {
      afterPublish: jest.fn().mockResolvedValue({
        seoProjectId: 'seo-p1',
        seoSyncStatus: 'ok',
        trafficSyncStatus: 'ok',
        linked: true,
      }),
      preparePublishedHtml: jest.fn().mockResolvedValue({
        html: '<html><head><script data-liora-ai-seo-project="seo-p1"></script></head><body>x</body></html>',
        seoProjectId: 'seo-p1',
        seoSyncStatus: 'ok',
        trafficSyncStatus: 'ok',
        scriptsInjected: { seoPixel: true, umami: false },
      }),
    }
    const { service, registry } = createService({
      tenantContext,
      organizationProvisioning,
      aiSeoPublishService,
    })
    await service.openEditorSession('p1', 7)
    const persist = jest.spyOn(registry, 'persistPublishedArtifact')

    const result = await service.acceptPublishIntent({
      pageId: 'p1',
      html: '<html><body>x</body></html>',
    })

    expect(organizationProvisioning.ensureWorkspaceForUser).toHaveBeenCalledWith(7)
    expect(tenantContext.setContext).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 17,
        organizationId: 'org-17',
        appCode: 'ladipage',
      }),
    )
    expect(aiSeoPublishService.afterPublish).toHaveBeenCalledWith('p1', {
      name: 'p1',
      slug: 'p1',
    })
    expect(aiSeoPublishService.preparePublishedHtml).toHaveBeenCalledWith(
      'p1',
      '<html><body>x</body></html>',
    )
    expect(result.aiSeo).toEqual({
      projectId: 'seo-p1',
      status: 'ok',
      autoLinked: true,
    })
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'p1',
        html: expect.stringContaining('data-liora-ai-seo-project="seo-p1"'),
      }),
    )
  })

  it('accepts draft-saved intent without publishing', async () => {
    const { service, registry } = createService()
    const persist = jest.spyOn(registry, 'persistDraftArtifact')

    const result = await service.acceptDraftSaved({
      pageId: 'p1',
      html: '<html><body>draft</body></html>',
      seoTitle: 'Draft SEO',
    })

    expect(result).toEqual({ accepted: true, pageId: 'p1' })
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'p1',
        html: '<html><body>draft</body></html>',
        meta: expect.objectContaining({ title: 'Draft SEO' }),
      }),
    )
  })

  it('rejects publish intent when externalPageId does not match mapping', async () => {
    const { service } = createService()
    await service.materializeFromHtml({
      pageId: 'p1',
      html: '<h1>Hi</h1>',
      actorUserId: 7,
    })

    await expect(
      service.acceptPublishIntent({
        pageId: 'p1',
        externalPageId: 'page_other',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('verifies bridge signature', () => {
    const { service } = createService()
    const rawBody = JSON.stringify({ pageId: 'p1' })
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = signBridgePayload('bridge-secret', rawBody, timestamp)
    expect(() => service.verifyBridgeRequest(rawBody, timestamp, signature)).not.toThrow()
  })

  it('rejects invalid bridge signature', () => {
    const { service } = createService()
    expect(() => service.verifyBridgeRequest('{}', '1', 'deadbeef')).toThrow(
      UnauthorizedException,
    )
  })

  it('reports runtime health', async () => {
    const { service } = createService()
    const health = await service.runtimeHealth()
    expect(health.ok).toBe(true)
    expect(health.protocol).toBe('ladipage-instatic@1')
    expect(health.mock).toBe(true)
  })


})
