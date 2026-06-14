import { Injectable, Logger } from '@nestjs/common';
import { StripeWebhookHandler } from '../stripe';
import Stripe from 'stripe';
import { SubscriptionService } from './subscription.service';
import { Organization } from '../entities/organization.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Example declarative webhook handlers for billing.
 * These are automatically discovered by StripeWebhookExplorerService
 * (thanks to @StripeWebhookHandler decorator + DiscoveryModule).
 *
 * Add more events as needed (see Stripe docs for full list).
 */
@Injectable()
export class BillingWebhookHandlers {
  private readonly logger = new Logger(BillingWebhookHandlers.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  @StripeWebhookHandler('checkout.session.completed')
  async handleCheckoutCompleted(event: any) {
    const session = event.data.object as any;
    const orgId = session?.metadata?.organizationId;

    this.logger.log(`Checkout completed for org ${orgId}, session ${session?.id}`);

    if (orgId && session?.customer) {
      await this.orgRepo.update(
        { id: orgId },
        { paymentId: typeof session.customer === 'string' ? session.customer : session.customer.id },
      );
    }
  }

  @StripeWebhookHandler('invoice.paid')
  async handleInvoicePaid(event: any) {
    const invoice = event.data.object as any;
    const customerId = typeof invoice?.customer === 'string' ? invoice.customer : invoice?.customer?.id;

    this.logger.log(`Invoice paid: ${invoice?.id} for customer ${customerId}`);
  }

  @StripeWebhookHandler('customer.subscription.created')
  @StripeWebhookHandler('customer.subscription.updated')
  async handleSubscriptionChange(event: any) {
    const subscription = event.data.object as any;
    const customerId = typeof subscription?.customer === 'string' ? subscription.customer : subscription?.customer?.id;

    this.logger.log(`Subscription ${event.type}: ${subscription?.id} (customer ${customerId})`);
  }

  @StripeWebhookHandler('customer.subscription.deleted')
  async handleSubscriptionDeleted(event: any) {
    const subscription = event.data.object as any;
    this.logger.log(`Subscription cancelled/deleted: ${subscription?.id}`);
  }
}
