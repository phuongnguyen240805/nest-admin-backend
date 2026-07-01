import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { TenantGuard } from '@liora/nest-core'

import type { RpcContext } from '../ladipage-rpc/rpc-dispatcher.service'
import { ApplicationCatalogService } from './services/application-catalog.service'
import { ApplicationLifecycleService } from './services/application-lifecycle.service'

type RequestWithTenant = FastifyRequest & {
  user?: RpcContext['user']
  org?: RpcContext['org']
  tenantId?: number
}

type UpdateApplicationBody = {
  status_active?: boolean
  status_pin?: boolean
}

function buildContext(request: FastifyRequest): RpcContext {
  const req = request as RequestWithTenant
  const headerValue = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value

  return {
    host: request.hostname,
    path: request.url,
    storeId: headerValue(request.headers['store-id']),
    tenantId: req.tenantId ?? req.user?.activeTenantId ?? req.user?.tenantId,
    authorization: headerValue(request.headers.authorization),
    user: req.user,
    org: req.org,
  }
}

@UseGuards(TenantGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly catalogService: ApplicationCatalogService,
    private readonly lifecycleService: ApplicationLifecycleService,
  ) {}

  @Get()
  list(
    @Query('lang') lang: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.catalogService.list({ lang: lang ?? 'vi' }, buildContext(request))
  }

  @Patch(':code')
  update(
    @Param('code') code: string,
    @Body() body: UpdateApplicationBody,
    @Req() request: FastifyRequest,
  ) {
    return this.lifecycleService.update({ ...body, code }, buildContext(request))
  }
}
