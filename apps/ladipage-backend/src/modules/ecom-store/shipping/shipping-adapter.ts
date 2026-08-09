import {
  SHIPPING_CAPABILITIES,
  type ShippingCapabilities,
  type ShippingProvider,
} from './core'

export type { ShippingProvider } from './core'

export interface ShippingIntegrationConfig {
  id: number
  provider: ShippingProvider
  enabled: boolean
  credentials: Record<string, string>
  settings: Record<string, unknown>
}

export interface ShippingTestResult {
  success: boolean
  message: string
}

export abstract class ShippingAdapter {
  abstract readonly provider: ShippingProvider
  abstract readonly name: string

  constructor(protected readonly config: ShippingIntegrationConfig) {}

  getCapabilities(): ShippingCapabilities {
    return SHIPPING_CAPABILITIES[this.provider]
  }

  abstract testConnection(): Promise<ShippingTestResult>
  abstract execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>>
}

export function providerError(error: unknown): string {
  const value = error as {
    response?: { data?: { message?: string; error?: string } }
    message?: string
  }
  return (
    value.response?.data?.message ||
    value.response?.data?.error ||
    value.message ||
    'Shipping provider request failed'
  )
}
