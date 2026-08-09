import { BadRequestException, Injectable } from '@nestjs/common'

import { GhnShippingAdapter } from './ghn.adapter'
import { GhtkShippingAdapter } from './ghtk.adapter'
import {
  ShippingAdapter,
  type ShippingIntegrationConfig,
  type ShippingProvider,
} from './shipping-adapter'

type ShippingAdapterFactory = (
  config: ShippingIntegrationConfig,
) => ShippingAdapter

@Injectable()
export class ShippingAdapterRegistry {
  private readonly factories = new Map<ShippingProvider, ShippingAdapterFactory>([
    ['ghn', (config) => new GhnShippingAdapter(config)],
    ['ghtk', (config) => new GhtkShippingAdapter(config)],
  ])

  registeredProviders(): ShippingProvider[] {
    return [...this.factories.keys()]
  }

  isRegistered(provider: ShippingProvider): boolean {
    return this.factories.has(provider)
  }

  create(config: ShippingIntegrationConfig): ShippingAdapter {
    const factory = this.factories.get(config.provider)
    if (!factory) {
      throw new BadRequestException(
        `Nhà vận chuyển ${config.provider} chưa có adapter production`,
      )
    }
    return factory(config)
  }
}
