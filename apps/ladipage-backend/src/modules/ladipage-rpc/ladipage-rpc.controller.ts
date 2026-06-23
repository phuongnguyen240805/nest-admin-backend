import { Body, Controller, Param, Post, Req, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Bypass, Public } from '@liora/nest-core';

import { LadipageRpcResponseInterceptor } from './rpc-response.interceptor';
import { RpcDispatcherService } from './rpc-dispatcher.service';

@Public()
@Bypass()
@Controller('ladipage')
@UseInterceptors(LadipageRpcResponseInterceptor)
export class LadipageRpcController {
  constructor(private readonly dispatcher: RpcDispatcherService) {}

  @Post(':resource/:action')
  dispatchWithAction(
    @Param('resource') resource: string,
    @Param('action') action: string,
    @Body() body: Record<string, unknown>,
    @Req() request: FastifyRequest,
  ): Promise<unknown> {
    return this.dispatcher.dispatch(resource, action, body ?? {}, {
      host: request.hostname,
      path: request.url,
    });
  }

  @Post(':resource')
  dispatchResourceOnly(
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
    @Req() request: FastifyRequest,
  ): Promise<unknown> {
    return this.dispatcher.dispatch(resource, undefined, body ?? {}, {
      host: request.hostname,
      path: request.url,
    });
  }
}
