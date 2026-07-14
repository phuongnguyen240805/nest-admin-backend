import { ForbiddenException } from '@nestjs/common'

import { McpLandingService } from './mcp-landing.service'
import type { ApiKeyService, ValidatedApiKeyContext } from '../settings/api-key.service'
import type { LandingAiService } from '../landing-ai/services/landing-ai.service'

describe('McpLandingService', () => {
  const auth: ValidatedApiKeyContext = {
    apiKeyId: 1,
    tenantId: 10,
    organizationId: 'org-1',
    ownerId: '7',
    scopes: ['workspace:read', 'landing:read', 'landing:create', 'asset:generate'],
  }

  function buildService() {
    const apiKeyService = {
      hasScopes: jest.fn((actual: string[], required: string[]) => (
        required.every((scope) => actual.includes(scope))
      )),
    } as Pick<ApiKeyService, 'hasScopes'>
    const landingAiService = {
      createJob: jest.fn().mockResolvedValue({ jobId: 'job-1', pageId: 'page-1', status: 'queued' }),
      getJob: jest.fn().mockResolvedValue({ jobId: 'job-1', status: 'success' }),
    } as Pick<LandingAiService, 'createJob' | 'getJob'>

    return {
      service: new McpLandingService(apiKeyService as ApiKeyService, landingAiService as LandingAiService),
      landingAiService,
    }
  }

  it('lists only tools allowed by API key scopes', () => {
    const { service } = buildService()
    const result = service.listTools(auth)

    expect(result.tools.map((tool) => tool.name)).toEqual([
      'ladipage_workspace_get',
      'landingpage_create_draft',
      'landingpage_get',
    ])
  })

  it('maps landingpage_create_draft to LandingAiService.createJob', async () => {
    const { service, landingAiService } = buildService()

    const result = await service.callTool(
      'landingpage_create_draft',
      {
        name: 'Summer Campaign',
        prompt: 'Build a lead page',
        businessName: 'Ladi',
      },
      auth,
    )

    expect(result).toEqual({ jobId: 'job-1', pageId: 'page-1', status: 'queued' })
    expect(landingAiService.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ai',
        name: 'Summer Campaign',
        params: expect.objectContaining({
          prompt: 'Build a lead page',
          businessName: 'Ladi',
        }),
      }),
      7,
    )
  })

  it('rejects create draft without landing create scope', async () => {
    const { service } = buildService()
    await expect(service.callTool(
      'landingpage_create_draft',
      { name: 'Nope', prompt: 'Nope' },
      { ...auth, scopes: ['workspace:read'] },
    )).rejects.toBeInstanceOf(ForbiddenException)
  })
})
