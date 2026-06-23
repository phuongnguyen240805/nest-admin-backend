import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Bypass, Public } from '@liora/nest-core';

import { LadiflowContextGuard } from './ladiflow-context.guard';
import { LadiflowDispatcherService } from './ladiflow-dispatcher.service';
import { LadiflowResponseInterceptor } from './ladiflow-response.interceptor';

@Public()
@Bypass()
@Controller('ladiflow/1.0')
@UseGuards(LadiflowContextGuard)
@UseInterceptors(LadiflowResponseInterceptor)
export class LadiflowRpcController {
  constructor(private readonly dispatcher: LadiflowDispatcherService) {}

  @Post(':resource/:action')
  dispatchWithAction(
    @Param('resource') resource: string,
    @Param('action') action: string,
    @Body() body: Record<string, unknown>,
    @Req() request: FastifyRequest,
  ): Promise<unknown> {
    return this.dispatcher.dispatch(resource, action, body ?? {}, {
      ownerId: this.headerValue(request, 'owner-id'),
      authorization: this.headerValue(request, 'authorization'),
      host: request.hostname,
      path: request.url,
    });
  }

  private headerValue(request: FastifyRequest, key: string): string | undefined {
    const value = request.headers[key];
    return Array.isArray(value) ? value[0] : value;
  }
}
