import { LandingAiHtmlGeneratorService } from './landing-ai-html-generator.service'
import type { AiProviderGateway } from '../gateways/ai-provider-gateway.types'

describe('LandingAiHtmlGeneratorService', () => {
  it('uses AiProviderGateway and normalizes fenced HTML', async () => {
    const gateway: Pick<AiProviderGateway, 'generateText'> = {
      generateText: jest.fn().mockResolvedValue({
        text: '```html\n<html><body>Landing</body></html>\n```',
        usage: { inputTokens: 1, outputTokens: 2 },
        trace: { gateway: 'omniroute', provider: 'gemini-web2api' },
        warnings: [],
      }),
    }

    const service = new LandingAiHtmlGeneratorService(gateway as AiProviderGateway)
    const result = await service.generateHtml({
      tenantId: 1,
      organizationId: 'org-1',
      jobId: 'job-1',
      pageId: 'page-1',
      pageName: 'Demo',
      type: 'ai',
      params: { prompt: 'Make a page' },
      promptText: 'Make a page',
    })

    expect(result.html).toBe('<html><body>Landing</body></html>')
    expect(gateway.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: '1',
        invocationId: 'job-1',
        capability: 'text',
        sessionId: 'org-1:page-1',
      }),
    )
  })
})
