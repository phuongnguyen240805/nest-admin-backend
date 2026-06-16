import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StripeWebhookHandler } from '../stripe'
import { Organization } from '../entities/organization.entity'
import { Period, SubscriptionTier } from '../entities/subscription.entity'
import { PlanConfigService } from '../config/plan.config'
import { SubscriptionService } from './subscription.service'

@Injectable()
export class BillingWebhookHandlers {
  private readonly logger = new Logger(BillingWebhookHandlers.name)

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly planConfigService: PlanConfigService,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  @StripeWebhookHandler('checkout.session.completed')
  async handleCheckoutCompleted(event: any) {
    const session = event.data.object as any
    const orgId = session?.metadata?.organizationId

    this.logger.log(`Checkout completed for org ${orgId}, session ${session?.id}`)

    if (orgId && session?.customer) {
      await this.orgRepo.update(
        { id: orgId },
        { paymentId: typeof session.customer === 'string' ? session.customer : session.customer.id },
      )
    }

    if (orgId && session?.mode === 'subscription' && session?.subscription) {
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id

      await this.subscriptionService.upsertSubscription(orgId, {
        identifier: subscriptionId,
      })
    }
  }

  @StripeWebhookHandler('invoice.paid')
  async handleInvoicePaid(event: any) {
    const invoice = event.data.object as any
    const customerId = typeof invoice?.customer === 'string' ? invoice.customer : invoice?.customer?.id

    this.logger.log(`Invoice paid: ${invoice?.id} for customer ${customerId}`)
  }

  @StripeWebhookHandler('customer.subscription.created')
  @StripeWebhookHandler('customer.subscription.updated')
  async handleSubscriptionChange(event: any) {
    const subscription = event.data.object as any
    const customerId = typeof subscription?.customer === 'string'
      ? subscription.customer
      : subscription?.customer?.id

    this.logger.log(`Subscription ${event.type}: ${subscription?.id} (customer ${customerId})`)

    const org = await this.orgRepo.findOne({ where: { paymentId: customerId } })
    if (!org) {
      const orgId = subscription?.metadata?.organizationId
      if (!orgId) {
        this.logger.warn(`No organization found for Stripe customer ${customerId}`)
        return
      }

      await this.syncSubscriptionForOrg(orgId, subscription)
      return
    }

    await this.syncSubscriptionForOrg(org.id, subscription)
  }

  @StripeWebhookHandler('customer.subscription.deleted')
  async handleSubscriptionDeleted(event: any) {
    const subscription = event.data.object as any
    const customerId = typeof subscription?.customer === 'string'
      ? subscription.customer
      : subscription?.customer?.id

    this.logger.log(`Subscription cancelled/deleted: ${subscription?.id}`)

    const org = await this.orgRepo.findOne({ where: { paymentId: customerId } })
    const orgId = org?.id ?? subscription?.metadata?.organizationId

    if (!orgId) {
      this.logger.warn(`No organization found to downgrade after subscription deletion`)
      return
    }

    await this.subscriptionService.updateSubscription(orgId, {
      subscriptionTier: SubscriptionTier.FREE,
      identifier: undefined,
      cancelAt: undefined,
      period: Period.MONTHLY,
      isLifetime: false,
    })
  }

  private async syncSubscriptionForOrg(orgId: string, subscription: any) {
    const priceObject = subscription?.items?.data?.[0]?.price
    const priceId = priceObject?.id
      ?? (typeof priceObject === 'string' ? priceObject : undefined)
    const priceMetadata = typeof priceObject === 'object' ? priceObject?.metadata : undefined
    const productMetadata = typeof priceObject === 'object'
      ? priceObject?.product?.metadata
      : undefined

    const tier = this.planConfigService.resolveTierFromPriceId(priceId, {
      ...productMetadata,
      ...priceMetadata,
      ...subscription?.metadata,
    })
    const period = this.planConfigService.resolvePeriodFromPriceId(priceId)

    await this.subscriptionService.upsertSubscription(orgId, {
      subscriptionTier: tier,
      identifier: subscription.id,
      period: period as Period,
      cancelAt: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : undefined,
      isLifetime: tier === SubscriptionTier.LIFETIME,
    })
  }
}