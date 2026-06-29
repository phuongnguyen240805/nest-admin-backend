import { Injectable, OnModuleInit } from '@nestjs/common'

import { DomainService } from '../domain/domain.service'
import { PageService } from '../publish/services/page.service'
import { RpcDispatcherService } from './rpc-dispatcher.service'

@Injectable()
export class LandingRpcRegistrar implements OnModuleInit {
  constructor(
    private readonly dispatcher: RpcDispatcherService,
    private readonly pageService: PageService,
    private readonly domainService: DomainService,
  ) {}

  onModuleInit(): void {
    this.dispatcher.registerHandler('ladi-page/list', (body, ctx) =>
      this.pageService.list(body, ctx))
    this.dispatcher.registerHandler('ladi-page/show', (body, ctx) =>
      this.pageService.show(body, ctx))
    this.dispatcher.registerHandler('domain/list', (body, ctx) =>
      this.domainService.list(body, ctx))
  }
}
