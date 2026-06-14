import { DynamicModule, Module, Provider } from '@nestjs/common';
import Stripe from 'stripe';

import { STRIPE_CLIENT_TOKEN, STRIPE_CONFIG_TOKEN } from './stripe.constants';
import { StripeConfig } from './interfaces/stripe-config.interface';
import { StripeModuleAsyncOptions, StripeOptionsFactory } from './interfaces/stripe-module-async-options.interface';
import { StripeService } from './stripe.service';
import { StripeUtils } from './utils/stripe.utils';

/**
 * StripeModule (colocated inside billing for easy management & shared logic via nest-core).
 *
 * Ported & adapted from https://github.com/reyco1/nestjs-stripe
 * Provides:
 *  - StripeService (high level checkout, customer, subscription, portal, constructEvent)
 *  - StripeUtils
 *  - Raw client via STRIPE_CLIENT_TOKEN
 *  - Declarative webhook support via StripeWebhookModule + @StripeWebhookHandler
 */
@Module({})
export class StripeModule {
  static forRoot(config: StripeConfig): DynamicModule {
    const configProvider: Provider = {
      provide: STRIPE_CONFIG_TOKEN,
      useValue: config,
    };

    const stripeProvider: Provider = {
      provide: STRIPE_CLIENT_TOKEN,
      useValue: new Stripe(config.apiKey, {
        apiVersion: (config.apiVersion || '2025-01-27.acacia') as any,
      }),
    };

    return {
      module: StripeModule,
      providers: [
        configProvider,
        stripeProvider,
        StripeService,
        StripeUtils,
      ],
      exports: [StripeService, StripeUtils, STRIPE_CLIENT_TOKEN, STRIPE_CONFIG_TOKEN],
      global: true,
    };
  }

  static forRootAsync(options: StripeModuleAsyncOptions): DynamicModule {
    const configProvider = this.createAsyncConfigProvider(options);

    const stripeProvider: Provider = {
      provide: STRIPE_CLIENT_TOKEN,
      useFactory: (config: StripeConfig) => {
        return new Stripe(config.apiKey, {
          apiVersion: (config.apiVersion || '2025-01-27.acacia') as any,
        });
      },
      inject: [STRIPE_CONFIG_TOKEN],
    };

    return {
      module: StripeModule,
      imports: options.imports || [],
      providers: [
        configProvider,
        stripeProvider,
        StripeService,
        StripeUtils,
      ],
      exports: [StripeService, StripeUtils, STRIPE_CLIENT_TOKEN, STRIPE_CONFIG_TOKEN],
      global: true,
    };
  }

  private static createAsyncConfigProvider(options: StripeModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: STRIPE_CONFIG_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: STRIPE_CONFIG_TOKEN,
      useFactory: async (optionsFactory: StripeOptionsFactory) =>
        await optionsFactory.createStripeOptions(),
      inject: [options.useExisting || options.useClass!],
    };
  }
}
