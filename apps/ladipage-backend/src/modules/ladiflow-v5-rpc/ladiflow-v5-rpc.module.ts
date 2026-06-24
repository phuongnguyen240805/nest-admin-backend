import { Module } from '@nestjs/common';

import { LadiflowContextGuard } from '../ladiflow-rpc/ladiflow-context.guard';
import { LadiflowResponseInterceptor } from '../ladiflow-rpc/ladiflow-response.interceptor';
import { LadiflowV5DispatcherService } from './ladiflow-v5-dispatcher.service';
import { LadiflowV5RpcController } from './ladiflow-v5-rpc.controller';

@Module({
  controllers: [LadiflowV5RpcController],
  providers: [
    LadiflowContextGuard,
    LadiflowResponseInterceptor,
    LadiflowV5DispatcherService,
  ],
})
export class LadiflowV5RpcModule {}
