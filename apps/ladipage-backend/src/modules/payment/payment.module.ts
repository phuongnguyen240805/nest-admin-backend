import { Module } from '@nestjs/common';
import { BillingModule } from '@liora/nest-core';

/**
 * PaymentModule (Stripe)
 * Tái sử dụng toàn bộ Stripe infrastructure từ nest-core/billing/stripe
 * (checkout, subscription, webhook với @StripeWebhookHandler, portal...).
 *
 * Chỉ cần register thêm handler cho LadiPage-specific events nếu cần.
 */
@Module({
  imports: [BillingModule],
  exports: [BillingModule],
})
export class PaymentModule {}
