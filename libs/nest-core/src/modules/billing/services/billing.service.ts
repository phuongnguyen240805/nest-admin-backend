import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common'
import { toString } from 'lodash'
import type { BillingUsageDto, CheckoutSessionStatusDto, PlanTier } from '@liora/api-types'
import { UserEntity as User } from '~/modules/user/user.entity'
import { Organization } from '../entities/organization.entity'
import { PlanConfigService } from '../config/plan.config'
import { StripeService, StripeUtils } from '../stripe'
import { SubscriptionService } from './subscription.service'

@Injectable()
export class BillingService {
  constructor(
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
    private readonly stripeUtils: StripeUtils,
    private readonly planConfigService: PlanConfigService,
  ) {}

  async checkSession(org: Organization, sessionId: string): Promise<CheckoutSessionStatusDto> {
    try {
      const session = await this.stripeService.retrieveCheckoutSession(sessionId)
      const metadataOrgId = session.metadata?.organizationId

      if (metadataOrgId && metadataOrgId !== org.id) {
        throw new BadRequestException('Checkout session does not belong to this organization')
      }

      return {
        sessionId: session.id,
        status: session.status ?? 'unknown',
        paymentStatus: session.payment_status,
        subscriptionId: typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id,
        customerId: typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id,
      }
    } catch (error) {
      if (error instanceof BadRequestException)
        throw error

      return {
        sessionId,
        status: 'unknown',
      }
    }
  }

  async checkId(org: Organization, id: string) {
    return this.checkSession(org, id)
  }

  async checkDiscount(org: Organization) {
    return { offerCoupon: false }
  }

  async applyDiscount(org: Organization) {}

  async finishTrial(org: Organization) {
    try {
      // Could do subscription update here if needed
    } catch (err) {}
    return { finish: true }
  }

  async isTrialFinished(org: Organization) {
    return { finished: !org.isTrailing }
  }

  async embedded(
    org: Organization,
    user: User,
    body: any,
    uniqueId?: string,
  ) {
    const session = await this.stripeService.createSubscriptionCheckoutSession({
      successUrl: `${process.env.FRONTEND_URL || ''}/billing/success`,
      cancelUrl: `${process.env.FRONTEND_URL || ''}/billing`,
      lineItems: [
        {
          price: body?.priceId || body?.plan,
          quantity: 1,
        },
      ],
      customerId: org.paymentId,
      metadata: {
        organizationId: org.id,
        userId: toString(user.id),
        uniqueId: uniqueId || '',
      },
    })
    return { session, clientSecret: (session as any).client_secret }
  }

  async subscribe(
    org: Organization,
    user: User,
    body: any,
    uniqueId?: string,
  ) {
    return this.embedded(org, user, body, uniqueId)
  }

  async getPortalLink(org: Organization) {
    if (!org.paymentId) {
      throw new BadRequestException('No Stripe customer (paymentId) on organization')
    }
    const portal = await this.stripeService.createBillingPortalSession(
      org.paymentId,
      `${process.env.FRONTEND_URL || ''}/billing`,
    )
    return { portal: portal.url }
  }

  async getCurrentBilling(org: Organization) {
    const subscription = await this.subscriptionService.getSubscriptionByOrganizationId(org.id)
    if (!subscription)
      return null

    return this.subscriptionService.toSubscriptionDto(subscription)
  }

  async getUsage(org: Organization): Promise<BillingUsageDto> {
    const subscription = await this.subscriptionService.getOrCreateSubscription(org.id)
    const tier = subscription.subscriptionTier as PlanTier
    const limits = this.planConfigService.getLimitsForTier(tier)
    const creditBalance = await this.subscriptionService.getCreditBalance(org.id)
    const creditSpent = await this.subscriptionService.getCreditSpent(org.id)

    // Page/domain tables are not yet available — return zero counts with plan limits.
    const pagesUsed = 0
    const domainsUsed = 0

    return {
      pages: {
        used: pagesUsed,
        limit: limits.pages,
      },
      domains: {
        used: domainsUsed,
        limit: limits.domains,
      },
      credits: {
        used: creditSpent,
        balance: creditBalance,
        limit: limits.credits,
      },
      subscriptionTier: tier,
    }
  }

  async cancel(org: Organization): Promise<{ success: boolean; cancelAt?: string }> {
    const subscription = await this.subscriptionService.getSubscriptionByOrganizationId(org.id)

    if (!subscription?.identifier) {
      throw new BadRequestException('No active Stripe subscription to cancel')
    }

    const stripeSubscription = await this.stripeService.cancelSubscription(subscription.identifier)
    const cancelAt = stripeSubscription.cancel_at
      ? new Date(stripeSubscription.cancel_at * 1000)
      : undefined

    await this.subscriptionService.updateSubscription(org.id, {
      cancelAt,
    })

    return {
      success: true,
      cancelAt: cancelAt?.toISOString(),
    }
  }

  async prorate(org: Organization, body: any) {
    return { success: true, message: 'Proration not fully wired in new foundation yet' }
  }

  async lifetime(org: Organization, code: string) {
    return { success: true, message: 'Lifetime deal not fully implemented in new foundation yet' }
  }

  async crypto(org: Organization) {
    return { success: false, message: 'Crypto (Nowpayments) temporarily disabled' }
  }
}