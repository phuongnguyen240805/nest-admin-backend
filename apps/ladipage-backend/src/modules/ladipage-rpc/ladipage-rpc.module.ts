import { Module } from '@nestjs/common';

import { LadipageRpcController } from './ladipage-rpc.controller';
import { LadipageRpcResponseInterceptor } from './rpc-response.interceptor';
import { RpcDispatcherService } from './rpc-dispatcher.service';

@Module({
  controllers: [LadipageRpcController],
  providers: [RpcDispatcherService, LadipageRpcResponseInterceptor],
})
export class LadipageRpcModule {}
