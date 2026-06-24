import { Module } from '@nestjs/common';

import { LadiworkModule } from '../ladiwork/ladiwork.module';
import { LadiworkRpcRegistrar } from '../ladiwork/ladiwork-rpc.registrar';
import { LadiflowRpcController } from './ladiflow-rpc.controller';
import { LadiflowContextGuard } from './ladiflow-context.guard';
import { LadiflowDispatcherService } from './ladiflow-dispatcher.service';
import { LadiflowResponseInterceptor } from './ladiflow-response.interceptor';

@Module({
  imports: [LadiworkModule],
  controllers: [LadiflowRpcController],
  providers: [
    LadiflowContextGuard,
    LadiflowDispatcherService,
    LadiworkRpcRegistrar,
    LadiflowResponseInterceptor,
  ],
})
export class LadiflowRpcModule {}
