import { BullMqProcessor, BaseQueueProcessor } from '@liora/nest-core'
import type { Job } from 'bullmq'

import { HtmlToEditorConverter } from '../converters/html-to-editor.converter'
import { ScreenshotToCodeClient } from '../clients/screenshot-to-code.client'
import { LandingPromptBuilder } from '../prompts/landing-prompt.builder'
import { LANDING_AI_QUEUES } from '../queues/constants'
import { LandingAiJobStoreService } from '../services/landing-ai-job-store.service'
import { LandingAiMetricsService } from '../services/landing-ai-metrics.service'

import { LandingPagesStorageService } from '../services/landing-pages-storage.service'
import type { LandingAiGeneratePayload } from '../types/landing-ai-job.payload'

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return slug || `page-${Date.now()}`
}

@BullMqProcessor(LANDING_AI_QUEUES.GENERATE)
export class LandingAiGenerateProcessor extends BaseQueueProcessor<LandingAiGeneratePayload> {
  constructor(
    private readonly jobStore: LandingAiJobStoreService,
    private readonly s2cClient: ScreenshotToCodeClient,
    private readonly landingStorage: LandingPagesStorageService,
    private readonly metrics: LandingAiMetricsService,
  ) {
    super()
  }

  protected async processJob(job: Job<LandingAiGeneratePayload>): Promise<void> {
    const data = job.data
    const mockMode = this.s2cClient.isMockMode()
    this.logger.log(
      `landing_ai_generate job=${data.jobId} page=${data.pageId} `
      + `LANDING_AI_MOCK_GENERATE=${process.env.LANDING_AI_MOCK_GENERATE ?? '(unset)'} `
      + `mockMode=${mockMode} s2cWs=${process.env.SCREENSHOT_TO_CODE_WS_URL ?? '(unset)'}`,
    )
    const startedAt = new Date()
    const wallStart = Date.now()
    let screenshotDurationMs: number | undefined
    let s2cDurationMs: number | undefined
    let success = false

    await this.jobStore.setStatus(data.jobId, 'running', {
      startedAt,
      progress: 5,
    })
    await this.jobStore.appendEvent(data.jobId, 'Bắt đầu xử lý AI landing page', 5)

    const onProgress = async (message: string, progress?: number) => {
      if (progress != null) {
        await this.jobStore.updateJob(data.jobId, { progress })
        await this.updateProgress(job, progress)
      }
      await this.jobStore.appendEvent(data.jobId, message, progress ?? null)
    }

    try {
      const promptText = LandingPromptBuilder.buildTextPrompt(
        data.name,
        data.params,
        data.type,
      )

      let html = ''
      if (mockMode) {
        html = HtmlToEditorConverter.buildMockHtml(
          data.name,
          promptText,
          data.params.businessName,
        )
        await onProgress('Mock mode: sinh HTML cục bộ', 80)
      }
      else {
        let images: string[] | undefined
        if (data.type === 'clone') {
          if (!data.params.url) {
            throw new Error('Clone job requires params.url')
          }
          await onProgress('Đang chụp screenshot URL nguồn...', 20)
          const screenshotStarted = Date.now()
          const imageDataUrl = await this.s2cClient.captureScreenshot(data.params.url)
          screenshotDurationMs = Date.now() - screenshotStarted
          images = [imageDataUrl]
        }

        const imagePrompt =
          data.type === 'clone'
            ? LandingPromptBuilder.buildCloneImagePrompt(data.params)
            : promptText

        const s2cStarted = Date.now()
        html = await this.s2cClient.generate(
          {
            generationType: 'create',
            inputMode: data.type === 'clone' ? 'image' : 'text',
            promptText: imagePrompt,
            images,
          },
          (message, progress) => {
            void onProgress(message, progress)
          },
        )
        s2cDurationMs = Date.now() - s2cStarted
      }

      if (!html) {
        throw new Error('AI generation returned empty HTML')
      }

      const editorData = HtmlToEditorConverter.toPreserveEditorData(
        html,
        data.pageId,
        data.name,
        {
          style: data.params.style,
          industry: data.params.industry,
          businessName: data.params.businessName,
          generationSource: data.type,
          generationJobId: data.jobId,
        },
      )

      const preferredSlug = slugifyName(data.name)
      const { slug } = await this.landingStorage.upsertLandingPage({
        pageId: data.pageId,
        name: data.name,
        slug: preferredSlug,
        supabaseUserId: data.supabaseUserId,
        editorData,
        tagIds: data.tagIds,
        aiSourceHtml: html,
        generationMeta: {
          type: data.type,
          jobId: data.jobId,
          importMode: data.importMode ?? 'preserve',
          mock: mockMode,
        },
      })

      await this.jobStore.setStatus(data.jobId, 'success', {
        progress: 100,
        completedAt: new Date(),
        result: {
          pageId: data.pageId,
          slug,
          htmlLength: html.length,
          importMode: data.importMode ?? 'preserve',
          mock: mockMode,
        },
        errorMessage: null,
      })
      await this.jobStore.appendEvent(data.jobId, 'Hoàn thành tạo landing page', 100)
      await this.updateProgress(job, 100)
      success = true
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.jobStore.setStatus(data.jobId, 'failed', {
        completedAt: new Date(),
        errorMessage: message,
      })
      await this.jobStore.appendEvent(data.jobId, `Lỗi: ${message}`)
      throw error
    }
    finally {
      const totalDurationMs = Date.now() - wallStart

      this.metrics.recordJob({
        jobId: data.jobId,
        pageId: data.pageId,
        type: data.type,
        tenantId: data.tenantId,
        success,
        totalDurationMs,
        s2cDurationMs,
        screenshotDurationMs,
        mock: mockMode,
      })

      this.logger.log(
        JSON.stringify({
          event: success ? 'landing_ai_job_complete' : 'landing_ai_job_failed',
          jobId: data.jobId,
          pageId: data.pageId,
          type: data.type,
          tenantId: data.tenantId,
          organizationId: data.organizationId,
          totalDurationMs,
          s2cDurationMs: s2cDurationMs ?? null,
          screenshotDurationMs: screenshotDurationMs ?? null,
          mock: mockMode,
        }),
      )
    }
  }
}