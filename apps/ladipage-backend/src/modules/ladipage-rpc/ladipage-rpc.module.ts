import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module';
import { AnalyticsRpcRegistrar } from './analytics-rpc.registrar';
import { AppStoreModule } from '../app-store/app-store.module';
import { AppStoreRpcRegistrar } from '../app-store/app-store-rpc.registrar';
import { DomainModule } from '../domain/domain.module';
import { PublishModule } from '../publish/publish.module';
import { LadipageRpcController } from './ladipage-rpc.controller';
import { LandingRpcRegistrar } from './landing-rpc.registrar';
import { LadipageRpcResponseInterceptor } from './rpc-response.interceptor';
import { RpcDispatcherService } from './rpc-dispatcher.service';

@Module({
  imports: [
    AnalyticsModule,
    AppStoreModule,
    DomainModule,
    PublishModule,
  ],
  controllers: [LadipageRpcController],
  providers: [
    AnalyticsRpcRegistrar,
    RpcDispatcherService,
    AppStoreRpcRegistrar,
    LandingRpcRegistrar,
    LadipageRpcResponseInterceptor,
  ],
})
export class LadipageRpcModule {}
