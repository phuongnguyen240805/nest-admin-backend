export interface CreateSubscriptionDto {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
  description?: string;
}
