import { Injectable, OnModuleInit } from '@nestjs/common';

import { RpcDispatcherService } from '../ladipage-rpc/rpc-dispatcher.service';
import { ApplicationCatalogService } from './services/application-catalog.service';
import { ApplicationLifecycleService } from './services/application-lifecycle.service';

@Injectable()
export class AppStoreRpcRegistrar implements OnModuleInit {
  constructor(
    private readonly dispatcher: RpcDispatcherService,
    private readonly catalogService: ApplicationCatalogService,
    private readonly lifecycleService: ApplicationLifecycleService,
  ) {}

  onModuleInit(): void {
    this.dispatcher.registerHandler('application/list', (body, ctx) =>
      this.catalogService.list(body, ctx));
    this.dispatcher.registerHandler('application/update', (body, ctx) =>
      this.lifecycleService.update(body, ctx));
  }
}
