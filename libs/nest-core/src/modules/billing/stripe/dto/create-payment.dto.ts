export interface CreatePaymentDto {
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
  description?: string;
}
