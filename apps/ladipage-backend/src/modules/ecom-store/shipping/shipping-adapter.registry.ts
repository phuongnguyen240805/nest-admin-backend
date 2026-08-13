import { BadRequestException, Injectable } from '@nestjs/common'

import { GhnShippingAdapter } from './ghn.adapter'
import { GhtkShippingAdapter } from './ghtk.adapter'
import { PartnerHttpShippingAdapter } from './partner-http.adapter'
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
    ['viettel_post', (config) => new PartnerHttpShippingAdapter(config, 'viettel_post', 'Viettel Post')],
    ['jt_express', (config) => new PartnerHttpShippingAdapter(config, 'jt_express', 'J&T Express')],
    ['vnpost', (config) => new PartnerHttpShippingAdapter(config, 'vnpost', 'VNPost')],
    ['best_express', (config) => new PartnerHttpShippingAdapter(config, 'best_express', 'BEST Express')],
    ['ahamove', (config) => new PartnerHttpShippingAdapter(config, 'ahamove', 'Ahamove')],
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
