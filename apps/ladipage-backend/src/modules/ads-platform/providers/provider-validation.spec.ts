import type { ConfigService } from '@nestjs/config'

jest.mock('../core/ads-credential.service', () => ({ AdsCredentialService: class {} }))

import type { AdsCredentialService } from '../core/ads-credential.service'
import type { AdsFingerprintService } from '../core/ads-fingerprint.service'
import type { AdsProviderRegistry } from '../core/ads-provider-registry.service'
import { MetaAdsPlugin } from './meta/meta.plugin'
import { ShopeeAdsPlugin } from './shopee/shopee.plugin'
import { TikTokAdsPlugin } from './tiktok/tiktok.plugin'

const registry = {} as AdsProviderRegistry
const credentials = {} as AdsCredentialService
const fingerprint = {} as AdsFingerprintService

function config(values: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService
}

describe('ads provider validation and capabilities', () => {
  it('rejects ambiguous Meta budget and creative inputs', async () => {
    const plugin = new MetaAdsPlugin(registry, config(), credentials, fingerprint)
    const validation = await plugin.publish.validate({
      campaign: { name: 'Pilot', objective: 'OUTCOME_SALES' },
      adSet: {
        name: 'Set',
        billingEvent: 'IMPRESSIONS',
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        dailyBudget: 1000,
        lifetimeBudget: 5000,
      },
      creative: { name: 'Creative' },
      ad: { name: 'Ad' },
    })
    expect(validation.valid).toBe(false)
    expect(validation.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['BUDGET_CONFLICT', 'CREATIVE_STORY_REQUIRED']),
    )
  })

  it('requires TikTok business fields before creating external resources', async () => {
    const plugin = new TikTokAdsPlugin(registry, config(), credentials, fingerprint)
    const validation = await plugin.publish.validate({
      campaign: { campaignName: 'Pilot', objectiveType: 'WEB_CONVERSIONS' },
      adGroup: { adgroupName: 'Set', optimizationGoal: 'CONVERT', budget: 10 },
      ad: { adName: 'Ad', creatives: [] },
    })
    expect(validation.valid).toBe(false)
    expect(validation.issues.map((issue) => issue.code)).toContain('CREATIVE_REQUIRED')
    expect(validation.issues.some((issue) => issue.field === 'adGroup.placementType')).toBe(true)
  })

  it('keeps Shopee publish disabled unless both partner flags are enabled', () => {
    const observedOnly = new ShopeeAdsPlugin(registry, config(), credentials, fingerprint)
    expect(observedOnly.manifest.capabilities).toEqual(['BROWSER_SNAPSHOT'])

    const enabled = new ShopeeAdsPlugin(
      registry,
      config({
        SHOPEE_ADS_PARTNER_ENABLED: 'true',
        SHOPEE_ADS_PUBLISH_ENABLED: 'true',
      }),
      credentials,
      fingerprint,
    )
    expect(enabled.manifest.capabilities).toEqual(expect.arrayContaining(['CONNECTION', 'PUBLISH']))
  })
})
