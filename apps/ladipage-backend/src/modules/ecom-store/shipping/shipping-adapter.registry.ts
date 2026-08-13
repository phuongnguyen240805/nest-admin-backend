import { BadRequestException, Injectable } from '@nestjs/common'

import { AhamoveShippingAdapter } from './ahamove.adapter'
import { BestExpressShippingAdapter } from './best-express.adapter'
import { GhnShippingAdapter } from './ghn.adapter'
import { GhtkShippingAdapter } from './ghtk.adapter'
import { JtExpressShippingAdapter } from './jt-express.adapter'
import { ViettelPostShippingAdapter } from './viettel-post.adapter'
import { VnpostShippingAdapter } from './vnpost.adapter'
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
    ['viettel_post', (config) => new ViettelPostShippingAdapter(config)],
    ['jt_express', (config) => new JtExpressShippingAdapter(config)],
    ['vnpost', (config) => new VnpostShippingAdapter(config)],
    ['best_express', (config) => new BestExpressShippingAdapter(config)],
    ['ahamove', (config) => new AhamoveShippingAdapter(config)],
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
