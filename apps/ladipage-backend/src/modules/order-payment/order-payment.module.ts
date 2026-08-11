import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { TenantModule } from '@liora/nest-core'

import { EcomStoreModule } from '../ecom-store/ecom-store.module'
import { OrderEntity } from '../ecom-store/entities/order.entity'
import { OrderPaymentController } from './controllers/order-payment.controller'
import { SepayWebhookController } from './controllers/sepay-webhook.controller'
import { OrderPaymentEntity, OrderPaymentEventEntity, SepayWebhookEventEntity } from './entities'
import { SepayQrProvider } from './providers/sepay/sepay-qr.provider'
import { SepayWebhookAuthService } from './providers/sepay/sepay-webhook-auth.service'
import { OrderPaymentService } from './services/order-payment.service'
import { SepayWebhookService } from './services/sepay-webhook.service'

@Module({
  imports: [
    TenantModule,
    EcomStoreModule,
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderPaymentEntity,
      OrderPaymentEventEntity,
      SepayWebhookEventEntity,
    ]),
  ],
  controllers: [OrderPaymentController, SepayWebhookController],
  providers: [
    OrderPaymentService,
    SepayWebhookService,
    SepayQrProvider,
    SepayWebhookAuthService,
  ],
  exports: [OrderPaymentService, TypeOrmModule],
})
export class OrderPaymentModule {}
