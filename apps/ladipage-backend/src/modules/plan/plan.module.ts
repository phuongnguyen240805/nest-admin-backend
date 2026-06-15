import { Module } from '@nestjs/common';
import { BillingModule } from '@liora/nest-core';

/**
 * PlanModule + gating logic
 * Quản lý gói (Free / Pro / Enterprise) và feature flags.
 * Phần lớn logic nằm trong Subscription + Organization của nest-core.
 */
@Module({
  imports: [BillingModule],
  exports: [BillingModule],
})
export class PlanModule {}
