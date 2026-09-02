import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'crypto'
import WebSocket from 'ws'

export interface S2cGenerateSettings {
  generationType: 'create' | 'update'
  inputMode: 'text' | 'image'
  promptText: string
  images?: string[]
  stack?: string
  model?: string
}

export type S2cProgressHandler = (message: string, progress?: number) => void

@Injectable()
export class ScreenshotToCodeClient {
  private readonly logger = new Logger(ScreenshotToCodeClient.name)

  private get httpBase(): string {
    return process.env.SCREENSHOT_TO_CODE_HTTP_URL ?? 'http://127.0.0.1:7010'
  }

  private get wsBase(): string {
    return process.env.SCREENSHOT_TO_CODE_WS_URL ?? 'ws://127.0.0.1:7010'
  }

  isMockMode(): boolean {
    return process.env.LANDING_AI_MOCK_GENERATE === 'true'
  }

  /**
   * Generate a new landing page from a text brief through screenshot-to-code.
   *
   * Keeping this method on the adapter makes the Landing AI processor unaware
   * of screenshot-to-code transport details and keeps text generation easy to
   * replace or extend later.
   */
  async generateText(
    promptText: string,
    onProgress?: S2cProgressHandler,
  ): Promise<string> {
    const normalizedPrompt = String(promptText ?? '').trim()
    if (!normalizedPrompt) {
      throw new Error('screenshot-to-code text prompt is required')
    }

    return this.generate(
      {
        generationType: 'create',
        inputMode: 'text',
        promptText: normalizedPrompt,
      },
      onProgress,
    )
  }

  async captureScreenshot(url: string): Promise<string> {
    const apiKey = process.env.SCREENSHOTONE_API_KEY
    if (!apiKey) {
      throw new Error('SCREENSHOTONE_API_KEY is required for clone URL jobs')
    }

    const response = await fetch(`${this.httpBase}/api/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, apiKey }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Screenshot capture failed (${response.status}): ${body}`)
    }

    const data = (await response.json()) as { url?: string }
    if (!data.url) {
      throw new Error('Screenshot capture returned empty image data')
    }
    return data.url
  }

  async generate(
    settings: S2cGenerateSettings,
    onProgress?: S2cProgressHandler,
  ): Promise<string> {
    if (this.isMockMode()) {
      onProgress?.('Mock mode: bỏ qua screenshot-to-code', 90)
      return ''
    }

    const wsUrl = `${this.wsBase.replace(/\/$/, '')}/generate-code`
    const payload = this.buildPayload(settings)
    const correlationId = this.createCorrelationId()

    this.logger.log(
      `s2c_generate_start correlationId=${correlationId} inputMode=${settings.inputMode} ws=${wsUrl}`,
    )

    return new Promise<string>((resolve, reject) => {
      let latestCode = ''
      let settled = false
      const timeoutMs = Number(process.env.S2C_GENERATE_TIMEOUT_MS ?? 300_000)

      const ws = new WebSocket(wsUrl)
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          ws.terminate()
          reject(new Error(`screenshot-to-code timeout after ${timeoutMs}ms`))
        }
      }, timeoutMs)

      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try {
          ws.close()
        }
        catch {
          // ignore close errors after the request is already settled
        }

        if (error) {
          this.logger.warn(
            `s2c_generate_failed correlationId=${correlationId} error=${error.message}`,
          )
          reject(error)
          return
        }

        if (!latestCode) {
          reject(new Error('screenshot-to-code returned empty HTML'))
          return
        }

        this.logger.log(
          `s2c_generate_complete correlationId=${correlationId} htmlLength=${latestCode.length}`,
        )
        resolve(latestCode)
      }

      ws.on('open', () => {
        onProgress?.('Đã kết nối AI generator', 15)
        ws.send(JSON.stringify(payload))
      })

      ws.on('message', (raw) => {
        try {
          const event = JSON.parse(String(raw)) as {
            type?: string
            value?: string
            variantIndex?: number
          }

          if (event.type === 'status' && event.value) {
            onProgress?.(event.value, 30)
          }
          if (event.type === 'thinking' && event.value) {
            onProgress?.('AI đang phân tích yêu cầu...', 45)
          }
          if (event.type === 'setCode' && event.value) {
            latestCode = event.value
            onProgress?.('Đang hoàn thiện HTML...', 75)
          }
          if (event.type === 'variantComplete') {
            onProgress?.('AI hoàn tất sinh landing page', 90)
            finish()
          }
          if (event.type === 'error') {
            finish(new Error(event.value ?? 'screenshot-to-code error'))
          }
        }
        catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)))
        }
      })

      ws.on('close', () => finish())
      ws.on('error', (error) => {
        finish(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  private buildPayload(settings: S2cGenerateSettings): Record<string, unknown> {
    return {
      generationType: settings.generationType,
      inputMode: settings.inputMode,
      prompt: {
        text: settings.promptText,
        images: settings.images ?? [],
      },
      generatedCodeConfig: settings.stack ?? process.env.S2C_DEFAULT_STACK ?? 'html_css',
      codeGenerationModel:
        settings.model
        ?? process.env.S2C_DEFAULT_MODEL
        ?? 'gemini-3-flash-preview (minimal thinking)',
      isImageGenerationEnabled: process.env.S2C_IMAGE_GENERATION_ENABLED !== 'false',
      openAiApiKey: process.env.OPENAI_API_KEY ?? null,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? null,
      geminiApiKey: process.env.GEMINI_API_KEY ?? null,
      replicateApiKey: process.env.REPLICATE_API_KEY ?? null,
      openAiBaseURL: process.env.OPENAI_BASE_URL ?? null,
      screenshotOneApiKey: process.env.SCREENSHOTONE_API_KEY ?? null,
      isTermOfServiceAccepted: true,
      history: [],
    }
  }

  createCorrelationId(): string {
    return randomUUID()
  }
}
