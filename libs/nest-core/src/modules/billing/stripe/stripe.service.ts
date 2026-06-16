import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

import { STRIPE_CLIENT_TOKEN } from './stripe.constants';
import {
  PaymentCheckoutSessionDto,
  SubscriptionCheckoutSessionDto,
} from './dto/checkout-session.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

/**
 * Clean StripeService (ported & adapted from https://github.com/reyco1/nestjs-stripe).
 *
 * This replaces the legacy scattered / heavily commented Stripe usage
 * previously living in libraries/nestjs_libraries and shared/services.
 *
 * All high-level operations (checkout, customer, subscription, webhooks construct)
 * should go through this service.
 *
 * Used internally by BillingModule / BillingService.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  constructor(
    @Inject(STRIPE_CLIENT_TOKEN) private readonly stripeClient: any,
  ) {}

  // =========================
  // Customers
  // =========================
  async createCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>,
  ) {
    return this.stripeClient.customers.create({
      email,
      name,
      metadata,
    });
  }

  // =========================
  // Checkout Sessions (recommended for most flows)
  // =========================
  async createPaymentCheckoutSession(
    params: PaymentCheckoutSessionDto,
  ): Promise<any> {
    const sessionConfig: any = {
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      line_items: params.lineItems.map((item) => ({
        price: item.price,
        quantity: item.quantity,
        price_data: !item.price
          ? {
              currency: item.currency!,
              unit_amount: item.amount,
              product_data: { name: item.name!, description: item.description },
            }
          : undefined,
      })),
      ...(params.customerId
        ? { customer: params.customerId }
        : { customer_creation: params.customerCreation || 'if_required' }),
      customer_email: params.customerEmail,
      client_reference_id: params.clientReferenceId,
      payment_method_types: params.paymentMethodTypes as any,
      metadata: params.metadata as any,
      allow_promotion_codes: params.allowPromotionCodes,
      locale: params.locale as any,
      billing_address_collection: params.billingAddressCollection,
      shipping_address_collection: params.shippingAddressCollection as any,
      submit_type: params.submitType,
    };

    const session = await this.stripeClient.checkout.sessions.create(sessionConfig);
    this.logger.debug(`Created payment checkout session: ${session.id}`);
    return session;
  }

  async createSubscriptionCheckoutSession(
    params: SubscriptionCheckoutSessionDto,
  ): Promise<any> {
    const sessionConfig: any = {
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      line_items: params.lineItems.map((item) => ({
        price: item.price,
        quantity: item.quantity,
      })),
      ...(params.customerId
        ? { customer: params.customerId }
        : { customer_creation: params.customerCreation || 'if_required' }),
      customer_email: params.customerEmail,
      client_reference_id: params.clientReferenceId,
      payment_method_types: params.paymentMethodTypes as any,
      metadata: params.metadata as any,
      allow_promotion_codes: params.allowPromotionCodes,
      locale: params.locale as any,
      subscription_data: params.subscriptionData
        ? {
            description: params.subscriptionData.description,
            metadata: params.subscriptionData.metadata,
            trial_period_days: params.trialPeriodDays,
          }
        : undefined,
    };

    const session = await this.stripeClient.checkout.sessions.create(sessionConfig);
    this.logger.debug(`Created subscription checkout session: ${session.id}`);
    return session;
  }

  // =========================
  // Payment Intents (lower level)
  // =========================
  async createPaymentIntent(data: CreatePaymentDto) {
    return this.stripeClient.paymentIntents.create({
      amount: data.amount,
      currency: data.currency,
      metadata: data.metadata,
      description: data.description,
    });
  }

  // =========================
  // Subscriptions
  // =========================
  async createSubscription(data: CreateSubscriptionDto) {
    return this.stripeClient.subscriptions.create({
      customer: data.customerId,
      items: [{ price: data.priceId }],
      metadata: data.metadata,
      description: data.description,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
  }

  async cancelSubscription(subscriptionId: string) {
    return this.stripeClient.subscriptions.cancel(subscriptionId);
  }

  async retrieveSubscription(subscriptionId: string) {
    return this.stripeClient.subscriptions.retrieve(subscriptionId);
  }

  async retrieveCheckoutSession(sessionId: string) {
    return this.stripeClient.checkout.sessions.retrieve(sessionId);
  }

  // =========================
  // Billing Portal
  // =========================
  async createBillingPortalSession(customerId: string, returnUrl: string) {
    return this.stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  // =========================
  // Webhook (construct + verify only - dispatching is in explorer)
  // =========================
  constructEvent(payload: Buffer | string, signature: string, webhookSecret: string) {
    return this.stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  // =========================
  // Convenience helpers used by current billing flows
  // =========================
  async getCustomerById(customerId: string) {
    return this.stripeClient.customers.retrieve(customerId);
  }

  async listCharges(limit = 10) {
    return this.stripeClient.charges.list({ limit });
  }

  async refundCharge(chargeId: string) {
    return this.stripeClient.refunds.create({ charge: chargeId });
  }
}
