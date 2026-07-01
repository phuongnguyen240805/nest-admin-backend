import type { PlanTier } from '@liora/api-types'

export type AppAccessRule = {
  code: string
  permission: string
  minTier: PlanTier
  priceVnd: number
}

export const APP_ACCESS_RULES: Record<string, AppAccessRule> = {
  WebsiteBuilder: {
    code: 'WebsiteBuilder',
    permission: 'app:website:use',
    minTier: 'free',
    priceVnd: 0,
  },
  Ecommerce: {
    code: 'Ecommerce',
    permission: 'app:ecom:use',
    minTier: 'free',
    priceVnd: 0,
  },
  Automation: {
    code: 'Automation',
    permission: 'app:automation:use',
    minTier: 'pro',
    priceVnd: 0,
  },
  LadiWork: {
    code: 'LadiWork',
    permission: 'app:office:use',
    minTier: 'pro',
    priceVnd: 0,
  },
  ELearning: {
    code: 'ELearning',
    permission: 'app:elearning:use',
    minTier: 'free',
    priceVnd: 0,
  },
  FacebookAds: {
    code: 'FacebookAds',
    permission: 'app:fbads:use',
    minTier: 'free',
    priceVnd: 0,
  },
  CloudPhone: {
    code: 'CloudPhone',
    permission: 'app:cloudphone:use',
    minTier: 'pro',
    priceVnd: 0,
  },
  OfferKit: {
    code: 'OfferKit',
    permission: 'app:offerkit:use',
    minTier: 'pro',
    priceVnd: 2_400_000,
  },
  AiSeo: {
    code: 'AiSeo',
    permission: 'app:aiseo:use',
    minTier: 'pro',
    priceVnd: 1_500_000,
  },
  SiteMetrics: {
    code: 'SiteMetrics',
    permission: 'app:metrics:use',
    minTier: 'free',
    priceVnd: 0,
  },
  Local: {
    code: 'Local',
    permission: 'app:local:use',
    minTier: 'pro',
    priceVnd: 800_000,
  },
  Content: {
    code: 'Content',
    permission: 'app:content:use',
    minTier: 'pro',
    priceVnd: 1_500_000,
  },
  Keywords: {
    code: 'Keywords',
    permission: 'app:keywords:use',
    minTier: 'free',
    priceVnd: 0,
  },
  Reports: {
    code: 'Reports',
    permission: 'app:reports:use',
    minTier: 'free',
    priceVnd: 0,
  },
  Authority: {
    code: 'Authority',
    permission: 'app:authority:use',
    minTier: 'enterprise',
    priceVnd: 0,
  },
}

export const TIER_RANK: Record<PlanTier | 'lifetime', number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
  lifetime: 2,
}
