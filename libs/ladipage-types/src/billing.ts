export type PlanTier = 'free' | 'pro' | 'enterprise';

export type SubscriptionPeriod = 'monthly' | 'yearly' | 'lifetime';

export interface PlanPriceIdsDto {
  monthly?: string;
  yearly?: string;
}

export interface PlanLimitsDto {
  pages: number;
  domains: number;
  credits: number;
}

export interface PlanDto {
  id: PlanTier;
  name: string;
  description?: string;
  priceIds: PlanPriceIdsDto;
  features: string[];
  limits: PlanLimitsDto;
}

export interface UsageMetricDto {
  used: number;
  limit: number;
}

export interface CreditsUsageDto {
  used: number;
  balance: number;
  limit: number;
}

export interface BillingUsageDto {
  pages: UsageMetricDto;
  domains: UsageMetricDto;
  credits: CreditsUsageDto;
  subscriptionTier: PlanTier;
}

export interface SubscriptionDto {
  id: string;
  organizationId: string;
  subscriptionTier: PlanTier;
  period: SubscriptionPeriod;
  identifier?: string;
  cancelAt?: string;
  isLifetime: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CheckoutSessionStatusDto {
  sessionId: string;
  status: string;
  paymentStatus?: string;
  subscriptionId?: string;
  customerId?: string;
}