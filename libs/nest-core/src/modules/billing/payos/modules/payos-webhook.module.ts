import { DynamicModule, Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'

import { PayOsWebhookController } from '../controllers/payos-webhook.controller'
import { PayOsWebhookExplorerService } from '../services/payos-webhook-explorer.service'

@Module({})
export class PayOsWebhookModule {
  static forRoot(): DynamicModule {
    return {
      module: PayOsWebhookModule,
      imports: [DiscoveryModule],
      controllers: [PayOsWebhookController],
      providers: [PayOsWebhookExplorerService],
      exports: [PayOsWebhookExplorerService],
    }
  }
}