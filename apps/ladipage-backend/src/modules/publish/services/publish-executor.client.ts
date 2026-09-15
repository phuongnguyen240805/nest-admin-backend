import { Injectable } from '@nestjs/common'

import {
  PUBLISH_SIGNATURE_HEADER,
  PUBLISH_TIMESTAMP_HEADER,
  createPublishSignature,
} from './publish-signature'

export interface PublishExecutorRequest {
  jobId: string
  jobSequence: number
  pageId: string
  tenantId: number
  organizationId: string | null
  userId: number
  ownerId: string
  payload: Record<string, unknown>
  instaticHtml?: string | null
}

@Injectable()
export class PublishExecutorClient {
  isConfigured(): boolean {
    return Boolean(this.executorUrl() && this.secret())
  }

  async execute(input: PublishExecutorRequest): Promise<Record<string, unknown>> {
    const url = this.executorUrl()
    const secret = this.secret()
    if (!url || !secret) {
      throw Object.assign(new Error('Landing publish executor is not configured'), {
        code: 'PUBLISH_EXECUTOR_NOT_CONFIGURED',
        retryable: false,
      })
    }

    const body = JSON.stringify(input)
    const timestamp = String(Date.now())
    const signature = createPublishSignature(secret, timestamp, body)
    const controller = new AbortController()
    const configuredTimeout = Number(process.env.LANDING_PUBLISH_EXECUTOR_TIMEOUT_MS)
    const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? Math.max(5_000, Math.min(configuredTimeout, 10 * 60_000))
      : 120_000
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [PUBLISH_TIMESTAMP_HEADER]: timestamp,
          [PUBLISH_SIGNATURE_HEADER]: signature,
        },
        body,
        signal: controller.signal,
      })

      const payload = await response.json().catch(() => null) as
        | Record<string, unknown>
        | null
      if (!response.ok || !payload) {
        const message = typeof payload?.error === 'string'
          ? payload.error
          : `Publish executor failed (${response.status})`
        const code = typeof payload?.code === 'string' && payload.code.trim()
          ? payload.code.trim().slice(0, 64)
          : `PUBLISH_EXECUTOR_${response.status}`
        throw Object.assign(new Error(message), {
          code,
          retryable: response.status >= 500 || response.status === 429,
        })
      }
      return payload
    }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw Object.assign(new Error('Publish executor timed out'), {
          code: 'PUBLISH_EXECUTOR_TIMEOUT',
          retryable: true,
        })
      }
      throw error
    }
    finally {
      clearTimeout(timeout)
    }
  }

  private executorUrl(): string | null {
    const value = process.env.LANDING_PUBLISH_EXECUTOR_URL?.trim()
    return value || null
  }

  private secret(): string | null {
    const value = process.env.LANDING_PUBLISH_EXECUTOR_SECRET?.trim()
    return value && value.length >= 32 ? value : null
  }
}
