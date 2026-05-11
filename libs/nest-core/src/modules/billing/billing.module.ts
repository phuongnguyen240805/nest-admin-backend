import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StripeService } from '~/libraries/nestjs_libraries/src/services/stripe.service'
import { Nowpayments } from '../../shared/crypto/nowpayments'
import { AuthModule } from '../auth/auth.module'
// import { NotificationService } from '../sse/sse.service'
import { BillingController } from './billing.controller'
import { CreditWallet } from './entities/credit-wallet.entity'
import { Subscription } from './entities/subscription.entity'
import { BillingService } from './services/billing.service'
import { SubscriptionService } from './services/subscription.service'

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, CreditWallet]), AuthModule],
  controllers: [BillingController],
  providers: [BillingService, SubscriptionService, StripeService, Nowpayments],
  exports: [BillingService, SubscriptionService],
})
export class BillingModule {}
