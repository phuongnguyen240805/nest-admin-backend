import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import { BillingSubscribeDto } from '~/modules/billing/dto/billing.subscribe.dto'
import { Organization } from '~/modules/billing/entities/organization.entity'

@Injectable()
export class StripeService {
  private stripe

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY')!,
    //   { apiVersion: '2024-06-20' },
    )
  }

  async createCheckoutSession(
    org: Organization,
    plan: string,
    successUrl?: string,
    cancelUrl?: string,
  ) {
    // const customer = await this.getOrCreateCustomer(org)

    // const session = await this.stripe.checkout.sessions.create({
    //   customer: customer.id,
    //   mode: 'subscription',
    //   payment_method_types: ['card'],
    //   line_items: [
    //     {
    //       price: this.getPriceIdByPlan(plan),
    //       quantity: 1,
    //     },
    //   ],
    //   success_url: successUrl || `${this.configService.get('FRONTEND_URL')}/billing/success`,
    //   cancel_url: cancelUrl || `${this.configService.get('FRONTEND_URL')}/billing`,
    //   metadata: {
    //     organizationId: org.id,
    //     plan,
    //   },
    // })

    // return session
  }

  async embedded(
    uniqueId: string | undefined,
    organizationId: string,
    userId: string,
    body: BillingSubscribeDto,
    allowTrial: boolean,
  ) {
    // Tạo session embed (Payment Element)
    // const customer = await this.getOrCreateCustomer({ id: organizationId } as Organization)
    // const session = await this.stripe.checkout.sessions.create({
    //   customer: customer.id,
    //   mode: 'subscription',
    //   payment_method_types: ['card'],
    //   line_items: [{ price: this.getPriceIdByPlan(body.plan), quantity: 1 }],
    //   ui_mode: 'embedded',
    //   return_url: `${this.configService.get('FRONTEND_URL')}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    //   metadata: { organizationId, userId, plan: body.plan },
    // })

    // return { clientSecret: session.client_secret }
  }

  async subscribe(
    uniqueId: string | undefined,
    organizationId: string,
    userId: string,
    body: BillingSubscribeDto,
    allowTrial: boolean,
  ) {
    return this.createCheckoutSession({ id: organizationId } as Organization, body.plan)
  }

  private getPriceIdByPlan(plan: string): string {
    const priceMap: Record<string, string> = {
      pro: this.configService.get('STRIPE_PRICE_PRO')!,
      enterprise: this.configService.get('STRIPE_PRICE_ENTERPRISE')!,
      lifetime: this.configService.get('STRIPE_PRICE_LIFETIME')!,
    }
    return priceMap[plan] || this.configService.get('STRIPE_PRICE_PRO')!
  }

  async getOrCreateCustomer(org: Organization) {
    // if (org.stripeCustomerId) {
    //   return this.stripe.customers.retrieve(org.stripeCustomerId)
    // }

    // const customer = await this.stripe.customers.create({
    //   name: org.name,
    //   email: org.owner?.email,
    //   metadata: { organizationId: org.id },
    // })

    // return customer
  }

  async createBillingPortalLink(customer) {
    const portal = await this.stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${this.configService.get('FRONTEND_URL')}/billing`,
    })
    return portal
  }

  async getCustomerByOrganizationId(organizationId: string) {
    // Thực tế nên query từ DB, tạm thời mock
    return { id: 'cus_xxx' } 
  }

  async checkSubscription(organizationId: string, subscriptionId: string) {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId)
    return sub.status
  }

  async checkDiscount(paymentId: string) {
    // Logic kiểm tra discount (tùy theo business)
    return false
  }

  async applyDiscount(paymentId: string) {
    // Logic apply coupon
    console.log(`Apply discount for payment ${paymentId}`)
  }

  async finishTrial(paymentId: string) {
    console.log(`Finish trial for ${paymentId}`)
  }

  async setToCancel(organizationId: string) {
    // Tìm subscription và set cancel_at_period_end = true
    console.log(`Set to cancel for org ${organizationId}`)
  }

  async prorate(organizationId: string, body: BillingSubscribeDto) {
    return { success: true, message: 'Prorated successfully' }
  }

  async lifetimeDeal(organizationId: string, code: string) {
    return { success: true, message: 'Lifetime deal activated' }
  }

  async getCharges(organizationId: string) {
    return this.stripe.charges.list({ limit: 10 })
  }

  async refundCharges(organizationId: string, chargeIds: string[]) {
    const results = []
    for (const chargeId of chargeIds) {
      const refund = await this.stripe.refunds.create({ charge: chargeId })
      results.push(refund)
    }
    return results
  }

  async cancelSubscription(organizationId: string) {
    console.log(`Cancel subscription for org ${organizationId}`)
    return { success: true }
  }

  // Webhook helper
  constructEvent(rawBody: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.configService.get('STRIPE_WEBHOOK_SECRET')!,
    )
  }
}
