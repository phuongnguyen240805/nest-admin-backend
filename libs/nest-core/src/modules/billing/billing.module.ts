import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'

import { Nowpayments } from '../../shared/crypto/nowpayments'
import { AuthModule } from '../auth/auth.module'
import { TenantModule } from '../tenant/tenant.module'
// import { NotificationService } from '../sse/sse.service'
import { BillingController } from './billing.controller'
import { CreditWallet } from './entities/credit-wallet.entity'
import { BillingOrder } from './entities/billing-order.entity'
import { Subscription } from './entities/subscription.entity'
import { Organization } from './entities/organization.entity'
import { PlanConfigService } from './config/plan.config'
import { BillingService } from './services/billing.service'
import { BillingOrderService } from './services/billing-order.service'
import { SubscriptionService } from './services/subscription.service'
import { BillingWebhookHandlers } from './services/billing-webhook.handlers'
import { PayOsModule } from './payos/payos.module'
import { PayOsWebhookModule } from './payos/modules/payos-webhook.module'
import { PayOsWebhookHandlers } from './payos/services/payos-webhook.handlers'

// NEW clean Stripe integration (colocated inside billing/ as per plan)
// Ported & adapted from https://github.com/reyco1/nestjs-stripe
// All Stripe + webhook logic now lives under billing/stripe/ for easy management (nest-core shared logic).
import { StripeModule } from './stripe/stripe.module'
import { StripeWebhookModule } from './stripe/modules/stripe-webhook.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, CreditWallet, Organization, BillingOrder]),
    AuthModule,
    TenantModule,
    // Clean Stripe foundation (ported from reyco1/nestjs-stripe)
    StripeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        apiKey: configService.get<string>('STRIPE_SECRET_KEY')!,
        webhookSecret: configService.get<string>('STRIPE_WEBHOOK_SECRET'),
        // apiVersion can be overridden via env if desired
      }),
    }),
    StripeWebhookModule.forRoot(),
    PayOsModule.forRootFromConfig(),
    PayOsWebhookModule.forRoot(),
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingOrderService,
    SubscriptionService,
    PlanConfigService,
    Nowpayments,
    BillingWebhookHandlers,
    PayOsWebhookHandlers,
  ],
  exports: [BillingService, SubscriptionService, PlanConfigService],
})
export class BillingModule {}
