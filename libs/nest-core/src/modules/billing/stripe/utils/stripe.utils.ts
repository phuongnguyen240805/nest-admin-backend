import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeUtils {
  /**
   * Format amount from Stripe (smallest unit) to human readable with currency.
   * Example: formatAmount(1000, 'usd') => '$10.00'
   */
  formatAmount(amount: number, currency = 'usd'): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });
    return formatter.format(amount / 100);
  }

  async getCustomerDetails(paymentIntent: any) {
    if (!paymentIntent.customer) return null;
    return {
      customerId: typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer.id,
      email: (paymentIntent.customer as any)?.email,
      name: (paymentIntent.customer as any)?.name,
    };
  }

  async getPaymentMethodDetails(paymentIntent: any) {
    const pm = paymentIntent.payment_method;
    if (!pm) return null;

    const paymentMethod = typeof pm === 'string' ? null : pm;

    return {
      id: typeof pm === 'string' ? pm : pm?.id,
      type: paymentMethod?.type,
      last4: (paymentMethod as any)?.card?.last4,
      brand: (paymentMethod as any)?.card?.brand,
      expMonth: (paymentMethod as any)?.card?.exp_month,
      expYear: (paymentMethod as any)?.card?.exp_year,
    };
  }

  async getRefundInfo(paymentIntent: any) {
    return {
      refunded: !!paymentIntent.amount_refunded && paymentIntent.amount_refunded > 0,
      refundedAmount: paymentIntent.amount_refunded,
    };
  }

  async getSubscriptionDetails(subscriptionId: string, stripeClient: any) {
    const sub = await stripeClient.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });

    return {
      id: sub.id,
      status: sub.status,
      currentPeriodStart: new Date((sub as any).current_period_start * 1000),
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
      trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : undefined,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : undefined,
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : undefined,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : undefined,
      endedAt: (sub as any).ended_at ? new Date((sub as any).ended_at * 1000) : undefined,
      metadata: sub.metadata,
      items: sub.items?.data?.map((item) => ({
        id: item.id,
        priceId: typeof item.price === 'string' ? item.price : item.price?.id,
        quantity: item.quantity,
      })),
    };
  }
}
