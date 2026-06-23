import { Module } from '@nestjs/common';

import { LadiflowRpcController } from './ladiflow-rpc.controller';
import { LadiflowContextGuard } from './ladiflow-context.guard';
import { LadiflowDispatcherService } from './ladiflow-dispatcher.service';
import { LadiflowResponseInterceptor } from './ladiflow-response.interceptor';

@Module({
  controllers: [LadiflowRpcController],
  providers: [
    LadiflowContextGuard,
    LadiflowDispatcherService,
    LadiflowResponseInterceptor,
  ],
})
export class LadiflowRpcModule {}
