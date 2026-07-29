import type { AiProviderGateway } from '../../landing-ai/gateways/ai-provider-gateway.types'
import type { SeoProjectEntity, SeoTaskEntity } from '../entities'
import { AiSeoAiImprovementService } from './ai-seo-ai-improvement.service'

describe('AiSeoAiImprovementService', () => {
  const project = {
    id: 'seo-project-1',
    tenantId: 12,
    landingPageId: 'landing-page-1',
    openseoProjectId: 'openseo-project-1',
    hostname: 'example.com',
    name: 'Example',
    holisticScores: { technicalsScore: 62 },
    siteAudit: { source: 'get_domain_overview' },
  } as unknown as SeoProjectEntity

  const task = {
    id: 'seo-task-1',
    externalTaskId: 'audit-issue-1',
    type: 'ON_PAGE',
    payload: {
      severity: 'warning',
      message: 'Meta title chưa tối ưu',
      suggested: 'Landing Page Example',
    },
  } as unknown as SeoTaskEntity

  it('normalizes a structured AI improvement generated from OpenSEO context', async () => {
    const gateway = {
      generateText: jest.fn().mockResolvedValue({
        text: '{"summary":"Tối ưu meta title","why":"Title hiện chưa rõ ý định tìm kiếm.","suggested":{"metaTitle":"Landing Page Example Tối Ưu Chuyển Đổi 2026","metaDescription":null,"content":null,"technicalSteps":[]},"canAutoDeploy":true}',
        json: {
          summary: 'Tối ưu meta title',
          why: 'Title hiện chưa rõ ý định tìm kiếm.',
          suggested: {
            metaTitle: 'Landing Page Example Tối Ưu Chuyển Đổi 2026',
            metaDescription: null,
            content: null,
            technicalSteps: [],
          },
          canAutoDeploy: true,
        },
        usage: {},
        trace: { gateway: 'omniroute', model: 'test-model' },
        warnings: [],
      }),
    } as unknown as AiProviderGateway
    const service = new AiSeoAiImprovementService(gateway)

    const result = await service.generate(project, task)

    expect(result).toMatchObject({
      source: 'openseo-ai-for-seo',
      summary: 'Tối ưu meta title',
      canAutoDeploy: true,
      suggested: {
        metaTitle: 'Landing Page Example Tối Ưu Chuyển Đổi 2026',
      },
    })
    expect(gateway.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormat: 'json',
        metadata: expect.objectContaining({
          toolName: 'openseo_ai_for_seo_improve',
        }),
      }),
    )
    const request = (gateway.generateText as jest.Mock).mock.calls[0][0]
    expect(request.messages[1].content).toContain('"source":"OpenSEO audit"')
    expect(request.messages[1].content).toContain('"openseoProjectId":"openseo-project-1"')
  })

  it('uses the OpenSEO task suggestion when the local fake gateway is not JSON-capable', async () => {
    const gateway = {
      generateText: jest.fn().mockResolvedValue({
        text: '<html>fake local response</html>',
        usage: {},
        trace: { gateway: 'fake' },
        warnings: ['fake'],
      }),
    } as unknown as AiProviderGateway
    const service = new AiSeoAiImprovementService(gateway)

    const result = await service.generate(project, task)

    expect(result.summary).toContain('Meta title chưa tối ưu')
    expect(result.suggested.metaTitle).toBe('Landing Page Example')
    expect(result.canAutoDeploy).toBe(true)
  })
})
