import { Injectable, ServiceUnavailableException } from '@nestjs/common'

import type {
  AiCapability,
  AiGatewayHealth,
  AiImageEditRequest,
  AiImageRequest,
  AiImageResult,
  AiListModelsRequest,
  AiModel,
  AiProviderGateway,
  AiProviderTrace,
  AiTextRequest,
  AiTextResult,
  AiUsage,
  AiVideoRequest,
  AiVideoResult,
} from './ai-provider-gateway.types'

interface OpenAiChatResponse {
  id?: string
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

interface OpenAiImageResponse {
  data?: Array<{
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
}

interface OpenAiModelsResponse {
  data?: Array<{
    id?: string
    owned_by?: string
  }>
}

@Injectable()
export class OmniRouteAiProviderGateway implements AiProviderGateway {
  async generateText(request: AiTextRequest): Promise<AiTextResult> {
    const startedAt = Date.now()
    const response = await this.post<OpenAiChatResponse>('chat/completions', {
      model: request.modelHint ?? process.env.OMNIROUTE_DEFAULT_TEXT_MODEL ?? 'auto',
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens,
      ...(request.responseFormat === 'json'
        ? { response_format: { type: 'json_object' } }
        : {}),
    }, request)

    const text = this.extractChatText(response.body)
    if (!text.trim()) {
      throw new ServiceUnavailableException('OmniRoute returned empty text response')
    }

    return {
      text,
      json: request.responseFormat === 'json' ? this.tryParseJson(text) : undefined,
      usage: this.buildUsage(response.headers, response.body.usage),
      trace: this.buildTrace(response.headers, startedAt, response.body.id),
      warnings: [],
    }
  }

  async generateImage(request: AiImageRequest): Promise<AiImageResult> {
    const startedAt = Date.now()
    const response = await this.post<OpenAiImageResponse>('images/generations', {
      model: request.modelHint ?? process.env.OMNIROUTE_DEFAULT_IMAGE_MODEL ?? 'auto',
      prompt: request.prompt,
      n: request.count ?? 1,
      size: request.size ?? '1024x1024',
      response_format: 'url',
      ...(request.styleHint ? { style: request.styleHint } : {}),
    }, request)

    const assets = (response.body.data ?? []).map((asset) => ({
      temporaryUrl: asset.url,
      assetId: asset.b64_json ? undefined : asset.url,
      mimeType: asset.b64_json ? 'image/png' : undefined,
    }))

    return {
      assets,
      usage: this.buildUsage(response.headers),
      trace: this.buildTrace(response.headers, startedAt),
      warnings: assets.length ? [] : ['OmniRoute image response did not include assets'],
    }
  }

  async editImage(_request: AiImageEditRequest): Promise<AiImageResult> {
    throw new ServiceUnavailableException('OmniRoute image edit capability is not enabled')
  }

  async generateVideo(_request: AiVideoRequest): Promise<AiVideoResult> {
    throw new ServiceUnavailableException('OmniRoute video capability is disabled')
  }

  async listModels(_request?: AiListModelsRequest): Promise<AiModel[]> {
    const response = await this.get<OpenAiModelsResponse>('models')
    return (response.data ?? [])
      .filter((model) => !!model.id)
      .map((model) => ({
        id: model.id as string,
        provider: model.owned_by,
      }))
  }

  async healthCheck(): Promise<AiGatewayHealth> {
    const startedAt = Date.now()
    try {
      await this.listModels()
      return {
        ok: true,
        gateway: 'omniroute',
        latencyMs: Date.now() - startedAt,
        availableCapabilities: this.availableCapabilities(),
      }
    }
    catch {
      return {
        ok: false,
        gateway: 'omniroute',
        latencyMs: Date.now() - startedAt,
        availableCapabilities: [],
        errorCode: 'OMNIROUTE_UNAVAILABLE',
      }
    }
  }

  private async post<T>(
    path: string,
    body: Record<string, unknown>,
    request: { idempotencyKey?: string; sessionId?: string; timeoutMs?: number },
  ): Promise<{ body: T; headers: Headers }> {
    const response = await this.fetchWithTimeout(
      this.url(path),
      {
        method: 'POST',
        headers: this.headers(request),
        body: JSON.stringify(body),
      },
      request.timeoutMs,
    )

    return this.parseResponse<T>(response)
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetchWithTimeout(this.url(path), {
      method: 'GET',
      headers: this.headers({}),
    })
    return (await this.parseResponse<T>(response)).body
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = Number(process.env.OMNIROUTE_TIMEOUT_MS ?? 60_000),
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException(`OmniRoute timeout after ${timeoutMs}ms`)
      }
      throw error
    }
    finally {
      clearTimeout(timer)
    }
  }

  private async parseResponse<T>(response: Response): Promise<{ body: T; headers: Headers }> {
    const raw = await response.text()
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `OmniRoute request failed (${response.status}): ${this.redact(raw)}`,
      )
    }

    try {
      return { body: raw ? JSON.parse(raw) as T : {} as T, headers: response.headers }
    }
    catch {
      throw new ServiceUnavailableException('OmniRoute returned invalid JSON')
    }
  }

  private headers(request: { idempotencyKey?: string; sessionId?: string }): Record<string, string> {
    const apiKey = process.env.OMNIROUTE_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException('OMNIROUTE_API_KEY is required')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    if (request.idempotencyKey) {
      headers['Idempotency-Key'] = request.idempotencyKey
    }
    if (request.sessionId) {
      headers['X-Session-Id'] = request.sessionId
    }
    if (process.env.OMNIROUTE_NO_CACHE === 'true') {
      headers['X-OmniRoute-No-Cache'] = 'true'
    }
    if (process.env.OMNIROUTE_NO_MEMORY !== 'false') {
      headers['x-omniroute-no-memory'] = 'true'
    }
    if (process.env.OMNIROUTE_COMPRESSION) {
      headers['x-omniroute-compression'] = process.env.OMNIROUTE_COMPRESSION
    }

    return headers
  }

  private url(path: string): string {
    const baseUrl = process.env.OMNIROUTE_BASE_URL ?? 'http://localhost:20128/v1'
    return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  }

  private extractChatText(response: OpenAiChatResponse): string {
    const content = response.choices?.[0]?.message?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content.map((item) => item.text ?? '').join('')
    }
    return ''
  }

  private buildUsage(headers: Headers, usage?: OpenAiChatResponse['usage']): AiUsage {
    return {
      inputTokens: this.headerNumber(headers, 'X-OmniRoute-Tokens-In') ?? usage?.prompt_tokens,
      outputTokens: this.headerNumber(headers, 'X-OmniRoute-Tokens-Out') ?? usage?.completion_tokens,
      estimatedCost: this.headerNumber(headers, 'X-OmniRoute-Response-Cost'),
      currency: 'USD',
    }
  }

  private buildTrace(headers: Headers, startedAt: number, requestId?: string): AiProviderTrace {
    return {
      gateway: 'omniroute',
      requestId,
      provider: headers.get('X-OmniRoute-Provider') ?? undefined,
      model: headers.get('X-OmniRoute-Model') ?? undefined,
      latencyMs: this.headerNumber(headers, 'X-OmniRoute-Latency-Ms') ?? Date.now() - startedAt,
      fallbackAttempts: this.headerNumber(headers, 'X-OmniRoute-Fallback-Attempts'),
      rawHeaders: this.omniRouteHeaders(headers),
    }
  }

  private omniRouteHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    for (const key of [
      'X-OmniRoute-Response-Cost',
      'X-OmniRoute-Tokens-In',
      'X-OmniRoute-Tokens-Out',
      'X-OmniRoute-Model',
      'X-OmniRoute-Provider',
      'X-OmniRoute-Latency-Ms',
      'X-OmniRoute-Fallback-Attempts',
    ]) {
      const value = headers.get(key)
      if (value) result[key] = value
    }
    return result
  }

  private headerNumber(headers: Headers, name: string): number | undefined {
    const value = headers.get(name)
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private availableCapabilities(): AiCapability[] {
    const capabilities: AiCapability[] = ['text', 'image']
    if (process.env.AI_GATEWAY_ENABLE_VIDEO === 'true') {
      capabilities.push('video')
    }
    return capabilities
  }

  private tryParseJson(text: string): unknown | undefined {
    try {
      return JSON.parse(text)
    }
    catch {
      return undefined
    }
  }

  private redact(value: string): string {
    return value.replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [redacted]')
  }
}
