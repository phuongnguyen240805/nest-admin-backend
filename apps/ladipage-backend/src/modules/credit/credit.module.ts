import { Module } from '@nestjs/common';
import { BillingModule } from '@liora/nest-core';

/**
 * CreditModule (tái sử dụng + mở rộng từ nest-core Billing)
 *
 * - Sử dụng trực tiếp: BillingService, SubscriptionService, CreditWallet entity
 * - Thêm business rules dành riêng cho LadiPage:
 *   + Trừ credit khi publish
 *   + Trừ credit khi dùng AI (Flowise / Agent)
 *   + Gói credit theo Plan
 */
@Module({
  imports: [BillingModule],
  providers: [
    // CreditService (wrapper)
  ],
  exports: [BillingModule],
})
export class CreditModule {}
