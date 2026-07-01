import { Body, Controller, Param, Post, Req, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Bypass, Public } from '@liora/nest-core';

import { LadipageRpcResponseInterceptor } from './rpc-response.interceptor';
import { RpcContext, RpcDispatcherService } from './rpc-dispatcher.service';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionalNumber(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildRpcContext(request: FastifyRequest): RpcContext {
  const req = request as FastifyRequest & {
    user?: RpcContext['user'];
    org?: RpcContext['org'];
    tenantId?: number;
  };

  return {
    host: request.hostname,
    path: request.url,
    storeId: firstHeaderValue(request.headers['store-id']),
    tenantId: req.tenantId ?? req.user?.activeTenantId ?? req.user?.tenantId
      ?? optionalNumber(firstHeaderValue(request.headers['x-tenant-id'])),
    authorization: firstHeaderValue(request.headers.authorization),
    user: req.user,
    org: req.org,
  };
}

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
    return this.dispatcher.dispatch(resource, action, body ?? {}, buildRpcContext(request));
  }

  @Post(':resource')
  dispatchResourceOnly(
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
    @Req() request: FastifyRequest,
  ): Promise<unknown> {
    return this.dispatcher.dispatch(resource, undefined, body ?? {}, buildRpcContext(request));
  }
}
