import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import axios, { AxiosError, type AxiosRequestConfig } from 'axios'

import type { AdsOperationError } from '@liora/ads-contracts'

export function requireProviderBaseUrl(
  value: string | undefined,
  allowedHosts: readonly string[],
  configName: string,
): string {
  if (!value) throw new ServiceUnavailableException(`${configName} is not configured`)
  const parsed = new URL(value)
  if (parsed.protocol !== 'https:' || !allowedHosts.includes(parsed.hostname)) {
    throw new ServiceUnavailableException(`${configName} does not use an allowed HTTPS host`)
  }
  return parsed.toString().replace(/\/$/, '')
}

export async function providerRequest<T>(
  baseURL: string,
  path: string,
  config: Omit<AxiosRequestConfig, 'baseURL' | 'url'>,
): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//') || /^https?:/i.test(path)) {
    throw new BadRequestException('Provider request path must be relative to the fixed base URL')
  }
  const response = await axios.request<T>({
    ...config,
    baseURL,
    url: path,
    timeout: config.timeout ?? 20_000,
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 300,
  })
  return response.data
}

export function normalizeProviderError(error: unknown, fallbackCode: string): AdsOperationError {
  const axiosError = error as AxiosError<Record<string, unknown>>
  const providerError = (axiosError.response?.data?.error ?? axiosError.response?.data) as
    | Record<string, unknown>
    | undefined
  const status = axiosError.response?.status
  const code = String(providerError?.code ?? providerError?.error_code ?? status ?? fallbackCode)
  const subcode = providerError?.error_subcode ?? providerError?.subcode
  const message = String(
    providerError?.message ?? providerError?.error_user_msg ?? axiosError.message ?? 'Provider request failed',
  )
  return {
    code: fallbackCode,
    message,
    retryable: status === 429 || status === 408 || (status != null && status >= 500),
    providerCode: code,
    providerSubcode: subcode == null ? undefined : String(subcode),
  }
}
