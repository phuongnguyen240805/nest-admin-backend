import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type {
  AdsCapability,
  AdsProvider,
  AdsProviderManifest,
  AdsProviderPlugin,
} from '@liora/ads-contracts'
import { hasAdsCapability } from '@liora/ads-contracts'

@Injectable()
export class AdsProviderRegistry {
  private readonly plugins = new Map<AdsProvider, AdsProviderPlugin>()

  register(plugin: AdsProviderPlugin): void {
    const provider = plugin.manifest.provider
    if (this.plugins.has(provider)) {
      throw new ConflictException(`Ads provider ${provider} is already registered`)
    }
    this.plugins.set(provider, plugin)
  }

  get(provider: AdsProvider): AdsProviderPlugin {
    const plugin = this.plugins.get(provider)
    if (!plugin) throw new NotFoundException(`Ads provider ${provider} is not registered`)
    return plugin
  }

  requireCapability(provider: AdsProvider, capability: AdsCapability): AdsProviderPlugin {
    const plugin = this.get(provider)
    if (!hasAdsCapability(plugin.manifest, capability)) {
      throw new NotFoundException(`${provider} does not support ${capability}`)
    }
    return plugin
  }

  list(): AdsProviderManifest[] {
    return Array.from(this.plugins.values(), (plugin) => plugin.manifest)
  }
}
