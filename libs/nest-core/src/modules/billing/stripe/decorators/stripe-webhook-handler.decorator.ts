import { SetMetadata } from '@nestjs/common';

export const STRIPE_WEBHOOK_HANDLER = 'STRIPE_WEBHOOK_HANDLER';

export interface StripeWebhookHandlerMetadata {
  eventName: string;
}

/**
 * Decorator for methods that should handle specific Stripe webhook events.
 * Ported from reyco1/nestjs-stripe.
 *
 * @example
 * @StripeWebhookHandler('customer.subscription.created')
 * async handleSubscriptionCreated(event: Stripe.Event) { ... }
 */
export const StripeWebhookHandler = (eventName: string) =>
  SetMetadata<string, StripeWebhookHandlerMetadata>(STRIPE_WEBHOOK_HANDLER, { eventName });
