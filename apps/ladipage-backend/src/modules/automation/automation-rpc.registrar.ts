import { Injectable, OnModuleInit } from '@nestjs/common'

import { LadiflowDispatcherService } from '../ladiflow-rpc/ladiflow-dispatcher.service'
import { AutomationService } from './services/automation.service'
import { AutomationTriggerService } from './triggers/automation-trigger.service'

@Injectable()
export class AutomationRpcRegistrar implements OnModuleInit {
  constructor(
    private readonly dispatcher: LadiflowDispatcherService,
    private readonly automationService: AutomationService,
    private readonly triggerService: AutomationTriggerService,
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


    // Phase 2 is additive: existing read routes above stay unchanged.
    this.dispatcher.registerHandler('flow/create', (body, ctx) =>
      this.automationService.createFlow(body, ctx))
    this.dispatcher.registerHandler('flow/update', (body, ctx) =>
      this.automationService.updateFlow(body, ctx))
    this.dispatcher.registerHandler('flow/validate', (body, ctx) =>
      this.automationService.validateFlow(body, ctx))
    this.dispatcher.registerHandler('flow/publish', (body, ctx) =>
      this.automationService.publishFlow(body, ctx))
    this.dispatcher.registerHandler('flow/unpublish', (body, ctx) =>
      this.automationService.unpublishFlow(body, ctx))
    this.dispatcher.registerHandler('flow/duplicate', (body, ctx) =>
      this.automationService.duplicateFlow(body, ctx))
    this.dispatcher.registerHandler('flow/delete', (body, ctx) =>
      this.automationService.deleteFlow(body, ctx))

    // Phase 3 only configures/shadows triggers. It does not execute a flow.
    this.dispatcher.registerHandler('trigger/list', (body, ctx) =>
      this.triggerService.list(body, ctx))
    this.dispatcher.registerHandler('trigger/create', (body, ctx) =>
      this.triggerService.create(body, ctx))
    this.dispatcher.registerHandler('trigger/update', (body, ctx) =>
      this.triggerService.update(body, ctx))
    this.dispatcher.registerHandler('trigger/delete', (body, ctx) =>
      this.triggerService.remove(body, ctx))
  }
}
