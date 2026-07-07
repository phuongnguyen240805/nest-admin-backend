import { DynamicModule, Module, Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { PAYOS_CONFIG_TOKEN } from './payos.constants'
import type { PayOsConfig } from './interfaces/payos-config.interface'
import { PayOsService } from './payos.service'

export interface PayOsModuleAsyncOptions {
  imports?: any[]
  inject?: any[]
  useFactory: (...args: any[]) => PayOsConfig | Promise<PayOsConfig>
}

@Module({})
export class PayOsModule {
  static forRootAsync(options: PayOsModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: PAYOS_CONFIG_TOKEN,
      useFactory: options.useFactory,
      inject: options.inject || [],
    }

    return {
      module: PayOsModule,
      imports: options.imports || [],
      providers: [configProvider, PayOsService],
      exports: [PayOsService, PAYOS_CONFIG_TOKEN],
      global: true,
    }
  }

  static forRootFromConfig(): DynamicModule {
    return this.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): PayOsConfig => ({
        clientId: configService.get<string>('PAYOS_CLIENT_ID') || '',
        apiKey: configService.get<string>('PAYOS_API_KEY') || '',
        checksumKey: configService.get<string>('PAYOS_CHECKSUM_KEY') || '',
        apiUrl: configService.get<string>('PAYOS_API_URL') || 'https://api-merchant.payos.vn',
      }),
    })
  }
}