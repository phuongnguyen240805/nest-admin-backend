import Stripe from 'stripe';

export interface LineItem {
  price?: string;
  quantity: number;

  // For ad-hoc (when not using existing price)
  currency?: string;
  amount?: number;
  name?: string;
  description?: string;

  adjustableQuantity?: {
    enabled: boolean;
    minimum?: number;
    maximum?: number;
  };
}

export interface PaymentCheckoutSessionDto {
  successUrl: string;
  cancelUrl: string;
  lineItems: LineItem[];

  customerId?: string;
  customerEmail?: string;
  customerCreation?: 'always' | 'if_required';

  paymentMethodTypes?: string[];
  allowPromotionCodes?: boolean;
  metadata?: Record<string, string | number>;
  clientReferenceId?: string;

  billingAddressCollection?: 'required' | 'auto';
  shippingAddressCollection?: { allowed_countries: string[] };
  locale?: string;
  submitType?: 'auto' | 'pay' | 'book' | 'donate';
  taxAutoCalculation?: boolean;

  paymentIntentData?: any;
}

export interface SubscriptionCheckoutSessionDto {
  successUrl: string;
  cancelUrl: string;
  lineItems: LineItem[];

  customerId?: string;
  customerEmail?: string;
  customerCreation?: 'always' | 'if_required';

  paymentMethodTypes?: string[];
  allowPromotionCodes?: boolean;
  metadata?: Record<string, string | number>;
  clientReferenceId?: string;

  billingAddressCollection?: 'required' | 'auto';
  shippingAddressCollection?: { allowed_countries: string[] };
  locale?: string;

  subscriptionData?: {
    description?: string;
    metadata?: Record<string, string>;
    transferData?: any;
  };
  trialPeriodDays?: number;
}
