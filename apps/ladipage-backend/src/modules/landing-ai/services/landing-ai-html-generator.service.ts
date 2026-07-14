import { Inject, Injectable } from '@nestjs/common'

import { HtmlToEditorConverter } from '../converters/html-to-editor.converter'
import type { LandingAiJobParamsDto } from '../dto/create-landing-ai-job.dto'
import type { AiProviderGateway } from '../gateways/ai-provider-gateway.types'
import { AI_PROVIDER_GATEWAY } from '../gateways/ai-provider-gateway.tokens'

export interface GenerateLandingHtmlInput {
  tenantId: number
  organizationId: string
  jobId: string
  pageId: string
  pageName: string
  type: 'ai' | 'clone' | 'ppc'
  params: LandingAiJobParamsDto
  promptText: string
  sourceImageUrl?: string
}

export interface GenerateLandingHtmlResult {
  html: string
  warnings: string[]
  trace: Record<string, unknown>
  usage: Record<string, unknown>
}

@Injectable()
export class LandingAiHtmlGeneratorService {
  constructor(
    @Inject(AI_PROVIDER_GATEWAY)
    private readonly gateway: AiProviderGateway,
  ) {}

  async generateHtml(input: GenerateLandingHtmlInput): Promise<GenerateLandingHtmlResult> {
    const response = await this.gateway.generateText({
      workspaceId: String(input.tenantId),
      invocationId: input.jobId,
      idempotencyKey: input.jobId,
      sessionId: `${input.organizationId}:${input.pageId}`,
      capability: 'text',
      modelHint: process.env.OMNIROUTE_DEFAULT_TEXT_MODEL,
      routingHint: 'quality',
      timeoutMs: Number(process.env.OMNIROUTE_TIMEOUT_MS ?? 60_000),
      metadata: {
        pageId: input.pageId,
        toolName: 'landingpage_create_draft',
        source: 'worker',
      },
      temperature: 0.25,
      maxTokens: Number(process.env.LANDING_AI_HTML_MAX_TOKENS ?? 12_000),
      messages: [
        {
          role: 'system',
          content: [
            'You are LadiPage landing page generator.',
            'Return one complete, production-ready HTML document only.',
            'Use inline CSS in a <style> tag.',
            'Do not include markdown fences, comments about the task, or external scripts.',
            'The page must be mobile-first, conversion-focused, and safe for marketing use.',
          ].join(' '),
        },
        {
          role: 'user',
          content: this.buildUserPrompt(input),
        },
      ],
    })

    const html = this.normalizeHtml(response.text, input)

    return {
      html,
      warnings: response.warnings,
      trace: response.trace as unknown as Record<string, unknown>,
      usage: response.usage as Record<string, unknown>,
    }
  }

  private buildUserPrompt(input: GenerateLandingHtmlInput): string {
    const parts = [
      `Page name: ${input.pageName}`,
      `Generation type: ${input.type}`,
      input.promptText,
    ]

    if (input.sourceImageUrl) {
      parts.push(
        `Reference screenshot URL: ${input.sourceImageUrl}`,
        'If the model cannot inspect images, create a clean landing page from the text brief instead.',
      )
    }

    parts.push(
      'Required sections: hero, benefits, trust/social proof, offer, FAQ, lead form, final CTA.',
      'Language: Vietnamese unless the brief explicitly asks for another language.',
      'Lead form target id must be contact.',
    )

    return parts.join('\n')
  }

  private normalizeHtml(raw: string, input: GenerateLandingHtmlInput): string {
    const html = raw
      .replace(/^```(?:html)?/i, '')
      .replace(/```$/i, '')
      .trim()

    if (html.toLowerCase().includes('<html')) {
      return html
    }

    return HtmlToEditorConverter.buildMockHtml(input.pageName, html, input.params.businessName)
  }
}
