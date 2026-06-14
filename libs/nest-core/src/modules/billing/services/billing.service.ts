import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { toString } from 'lodash'
import { AuthService } from '~/libraries/helpers/src/auth/auth.service'
// import { Nowpayments } from '~/libraries/nestjs-libraries/src/crypto/nowpayments'
import { UserEntity as User } from '~/modules/user/user.entity'
import { Organization } from '../entities/organization.entity'
// import { NotificationService } from '../sse/sse.service' // hoặc module notification
import { SubscriptionService } from './subscription.service'

// Use the new clean Stripe implementation (colocated in billing/stripe)
import { StripeService, StripeUtils } from '../stripe'

@Injectable()
export class BillingService {
  constructor(
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
    private readonly stripeUtils: StripeUtils,
    // private notificationService: NotificationService,
    // private nowpayments: Nowpayments,
  ) {}

  async checkId(org: Organization, id: string) {
    try {
      const sub = await this.stripeService.retrieveSubscription(id)
      return { status: sub.status }
    } catch {
      return { status: 'unknown' }
    }
  }

  async checkDiscount(org: Organization) {
    // Legacy coupon flow was mostly stub. Keep compatible response.
    return { offerCoupon: false }
  }

  async applyDiscount(org: Organization) {
    // was no-op / console in legacy
  }

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
    // Use the new rich checkout creator (subscription mode for recurring billing)
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
      throw new Error('No Stripe customer (paymentId) on organization')
    }
    const portal = await this.stripeService.createBillingPortalSession(
      org.paymentId,
      `${process.env.FRONTEND_URL || ''}/billing`,
    )
    return { portal: portal.url }
  }

  async getCurrentBilling(org: Organization) {
    return this.subscriptionService.getSubscriptionByOrganizationId(org.id)
  }

  //   async cancel(org: Organization, user: User, feedback: string) {
  //     await this.notificationService.sendEmail(
  //       process.env.EMAIL_FROM_ADDRESS!,
  //       'Subscription Cancelled',
  //       `Organization ${org.name} has cancelled their subscription because: ${feedback}`,
  //       user.email,
  //     )
  //     return this.stripeService.setToCancel(org.id)
  //   }

  async prorate(org: Organization, body: any) {
    // Real proration handled via Stripe subscription update (proration_behavior)
    return { success: true, message: 'Proration not fully wired in new foundation yet' }
  }

  async lifetime(org: Organization, code: string) {
    return { success: true, message: 'Lifetime deal not fully implemented in new foundation yet' }
  }

  //   async getCharges(org: Organization, user: User) {
  //     if (!user.isSuperAdmin)
  //       throw new HttpException('Unauthorized', 400)
  //     return this.stripeService.getCharges(org.id)
  //   }

  //   async refundCharges(org: Organization, user: User, chargeIds: string[]) {
  //     if (!user.isSuperAdmin)
  //       throw new HttpException('Unauthorized', 400)
  //     return this.stripeService.refundCharges(org.id, chargeIds)
  //   }

  //   async cancelSubscription(org: Organization, user: User) {
  //     if (!user.isSuperAdmin)
  //       throw new HttpException('Unauthorized', 400)
  //     return this.stripeService.cancelSubscription(org.id)
  //   }

  //   async addSubscription(org: Organization, user: User, subscription: string) {
  //     if (!user.isSuperAdmin)
  //       throw new HttpException('Unauthorized', 400)
  //     return this.subscriptionService.addSubscription(org.id, toString(user.id), { subscription })
  //   }

  async crypto(org: Organization) {
    // return this.nowpayments.createPaymentPage(org.id)
    return { success: false, message: 'Crypto (Nowpayments) temporarily disabled' }
  }
}
