import { BadRequestException, UnauthorizedException } from '@nestjs/common'

import { LandingPageService } from './landing-page.service'
import { PageRegistryStore } from './page-registry.store'
import { signBridgePayload } from '../instatic/instatic-hmac'

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

  function createService() {
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
    const artifact = await service.getPublishedArtifact('p1')
    expect(artifact.html).toContain('<html')
    expect(artifact.source).toBe('mock')
  })

  it('accepts publish intent with inline html', async () => {
    const { service } = createService()
    const result = await service.acceptPublishIntent({
      pageId: 'p1',
      html: '<html><body>x</body></html>',
      seoTitle: 'SEO',
    })
    expect(result.accepted).toBe(true)
    expect(result.artifact.meta.title).toBe('SEO')
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
