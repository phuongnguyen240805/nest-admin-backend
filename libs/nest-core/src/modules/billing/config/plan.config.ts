import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { PlanDto, PlanLimitsDto, PlanTier } from '@liora/api-types'
import { SubscriptionTier } from '../entities/subscription.entity'

export const PLAN_LIMITS: Record<PlanTier, PlanLimitsDto> = {
  free: { pages: 3, domains: 1, credits: 100 },
  pro: { pages: 50, domains: 5, credits: 1000 },
  enterprise: { pages: -1, domains: -1, credits: 10000 },
}

@Injectable()
export class PlanConfigService {
  constructor(private readonly configService: ConfigService) {}

  getPlans(): PlanDto[] {
    return [
      {
        id: 'free',
        name: 'Free',
        description: 'Get started with essential landing page tools',
        priceIds: {},
        features: [
          'Up to 3 pages',
          '1 custom domain',
          '100 credits / month',
        ],
        limits: PLAN_LIMITS.free,
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'Scale campaigns with more pages and domains',
        priceIds: {
          monthly: this.configService.get<string>('STRIPE_PRICE_PRO_MONTHLY'),
          yearly: this.configService.get<string>('STRIPE_PRICE_PRO_YEARLY'),
        },
        features: [
          'Up to 50 pages',
          '5 custom domains',
          '1,000 credits / month',
          'Priority support',
        ],
        limits: PLAN_LIMITS.pro,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Unlimited scale for teams and agencies',
        priceIds: {
          monthly: this.configService.get<string>('STRIPE_PRICE_ENTERPRISE_MONTHLY'),
          yearly: this.configService.get<string>('STRIPE_PRICE_ENTERPRISE_YEARLY'),
        },
        features: [
          'Unlimited pages',
          'Unlimited domains',
          '10,000 credits / month',
          'Dedicated support',
        ],
        limits: PLAN_LIMITS.enterprise,
      },
    ]
  }

  resolveTierFromPriceId(
    priceId?: string,
    metadata?: Record<string, string>,
  ): SubscriptionTier {
    const metadataTier = metadata?.subscriptionTier ?? metadata?.tier
    if (metadataTier) {
      const normalized = metadataTier.toLowerCase()
      if (normalized === SubscriptionTier.PRO)
        return SubscriptionTier.PRO
      if (normalized === SubscriptionTier.ENTERPRISE)
        return SubscriptionTier.ENTERPRISE
      if (normalized === SubscriptionTier.FREE)
        return SubscriptionTier.FREE
    }

    if (!priceId)
      return SubscriptionTier.FREE

    const priceToTier: Array<[string | undefined, SubscriptionTier]> = [
      [this.configService.get<string>('STRIPE_PRICE_PRO_MONTHLY'), SubscriptionTier.PRO],
      [this.configService.get<string>('STRIPE_PRICE_PRO_YEARLY'), SubscriptionTier.PRO],
      [this.configService.get<string>('STRIPE_PRICE_ENTERPRISE_MONTHLY'), SubscriptionTier.ENTERPRISE],
      [this.configService.get<string>('STRIPE_PRICE_ENTERPRISE_YEARLY'), SubscriptionTier.ENTERPRISE],
    ]

    for (const [configuredPriceId, tier] of priceToTier) {
      if (configuredPriceId && configuredPriceId === priceId)
        return tier
    }

    return SubscriptionTier.FREE
  }

  resolvePeriodFromPriceId(priceId?: string): 'monthly' | 'yearly' | 'lifetime' {
    if (!priceId)
      return 'monthly'

    const yearlyPrices = [
      this.configService.get<string>('STRIPE_PRICE_PRO_YEARLY'),
      this.configService.get<string>('STRIPE_PRICE_ENTERPRISE_YEARLY'),
    ]

    return yearlyPrices.includes(priceId) ? 'yearly' : 'monthly'
  }

  getLimitsForTier(tier: PlanTier): PlanLimitsDto {
    return PLAN_LIMITS[tier] ?? PLAN_LIMITS.free
  }
}