import { Module } from '@nestjs/common';
import { BillingModule } from '@liora/nest-core';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

/**
 * PlanModule + gating logic
 * Quản lý gói (Free / Pro / Enterprise) và feature flags.
 * Phần lớn logic nằm trong Subscription + Organization của nest-core.
 */
@Module({
  imports: [BillingModule],
  controllers: [PlanController],
  providers: [PlanService],
  exports: [BillingModule, PlanService],
})
export class PlanModule {}
