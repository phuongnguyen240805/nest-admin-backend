import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { toString } from 'lodash'
import { AuthService } from '~/libraries/helpers/src/auth/auth.service'
// import { Nowpayments } from '~/libraries/nestjs-libraries/src/crypto/nowpayments'
import { StripeService } from '~/libraries/nestjs_libraries/src/services/stripe.service'
import { UserEntity as User } from '~/modules/user/user.entity'
import { Organization } from '../entities/organization.entity'
// import { NotificationService } from '../sse/sse.service' // hoặc module notification
import { SubscriptionService } from './subscription.service'

@Injectable()
export class BillingService {
  constructor(
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptionService: SubscriptionService,
    private stripeService: StripeService,
    // private notificationService: NotificationService,
    // private nowpayments: Nowpayments,
  ) {}

  async checkId(org: Organization, id: string) {
    return {
      status: await this.stripeService.checkSubscription(org.id, id),
    }
  }

  async checkDiscount(org: Organization) {
    const hasDiscount = !(await this.stripeService.checkDiscount(org.paymentId))
    return {
      offerCoupon: hasDiscount ? false : AuthService.signJWT({ discount: true }),
    }
  }

  async applyDiscount(org: Organization) {
    await this.stripeService.applyDiscount(org.paymentId)
  }

  async finishTrial(org: Organization) {
    try {
      await this.stripeService.finishTrial(org.paymentId)
    }
    catch (err) {}
    return { finish: true }
  }

  async isTrialFinished(org: Organization) {
    return { finished: !org.isTrailing }
  }

  async embedded(
    org: Organization,
    user: User,
    body,
    uniqueId?: string,
  ) {
    return this.stripeService.embedded(
      uniqueId,
      org.id,
      toString(user.id),
      body,
      org.allowTrial,
    )
  }

  async subscribe(
    org: Organization,
    user: User,
    body,
    uniqueId?: string,
  ) {
    return this.stripeService.subscribe(
      uniqueId,
      org.id,
      toString(user.id),
      body,
      org.allowTrial,
    )
  }

  async getPortalLink(org: Organization) {
    const customer = await this.stripeService.getCustomerByOrganizationId(org.id)
    const { url } = await this.stripeService.createBillingPortalLink(customer as any)
    return { portal: url }
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

  async prorate(org: Organization, body) {
    return this.stripeService.prorate(org.id, body)
  }

  async lifetime(org: Organization, code: string) {
    return this.stripeService.lifetimeDeal(org.id, code)
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
  }
}
