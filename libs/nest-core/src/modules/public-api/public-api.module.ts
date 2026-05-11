import { Module } from '@nestjs/common'
import { AgentModule } from '../agent/agent.module'
import { BillingModule } from '../billing/billing.module'
import { PublicApiGuard } from './guards/public-api.guard'
import { PublicApiService } from './public-api.service'
import { PublicController } from './v1/public.controller'

@Module({
  imports: [
    BillingModule, // để check quota, usage
    AgentModule,
  ],
  controllers: [PublicController],
  providers: [
    PublicApiService,
    PublicApiGuard,
  ],
  exports: [PublicApiService],
})
export class PublicApiModule {}
