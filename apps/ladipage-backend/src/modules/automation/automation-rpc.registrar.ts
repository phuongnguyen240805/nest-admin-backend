import { Injectable, OnModuleInit } from '@nestjs/common'

import { LadiflowDispatcherService } from '../ladiflow-rpc/ladiflow-dispatcher.service'
import { AutomationService } from './services/automation.service'

@Injectable()
export class AutomationRpcRegistrar implements OnModuleInit {
  constructor(
    private readonly dispatcher: LadiflowDispatcherService,
    private readonly automationService: AutomationService,
  ) {}

  onModuleInit(): void {
    this.dispatcher.registerHandler('flow/list', (body, ctx) =>
      this.automationService.listFlows(body, ctx))
    this.dispatcher.registerHandler('broadcast/list', (body, ctx) =>
      this.automationService.listBroadcasts(body, ctx))
    this.dispatcher.registerHandler('integration/list-all', (body, ctx) =>
      this.automationService.listIntegrations(body, ctx))
    this.dispatcher.registerHandler('flow-tag/list-all', (body, ctx) =>
      this.automationService.listFlowTags(body, ctx))
    // Former v5 routes (flow editor etc.) now on unified /ladiflow
    this.dispatcher.registerHandler('flow/show', (body, ctx) =>
      this.automationService.showFlow(body, ctx))
  }
}
