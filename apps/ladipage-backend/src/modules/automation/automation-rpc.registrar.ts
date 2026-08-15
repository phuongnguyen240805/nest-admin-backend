import { Injectable, OnModuleInit } from '@nestjs/common'

import { LadiflowDispatcherService } from '../ladiflow-rpc/ladiflow-dispatcher.service'
import { AutomationBroadcastRuntimeService } from './broadcast/automation-broadcast-runtime.service'
import { AutomationSequenceService } from './sequence/automation-sequence.service'
import { AutomationService } from './services/automation.service'
import { AutomationTriggerService } from './triggers/automation-trigger.service'
import { AutomationChannelCapabilityService } from './integrations/automation-channel-capability.service'
import { AutomationOpsService } from './observability/automation-ops.service'

@Injectable()
export class AutomationRpcRegistrar implements OnModuleInit {
  constructor(
    private readonly dispatcher: LadiflowDispatcherService,
    private readonly automationService: AutomationService,
    private readonly triggerService: AutomationTriggerService,
    private readonly sequenceService: AutomationSequenceService,
    private readonly broadcastRuntime: AutomationBroadcastRuntimeService,
    private readonly channelCapabilities: AutomationChannelCapabilityService,
    private readonly ops: AutomationOpsService,
  ) {}

  onModuleInit(): void {
    // Existing read contracts stay unchanged.
    this.dispatcher.registerHandler('flow/list', (body, ctx) =>
      this.automationService.listFlows(body, ctx))
    this.dispatcher.registerHandler('broadcast/list', (body, ctx) =>
      this.automationService.listBroadcasts(body, ctx))
    this.dispatcher.registerHandler('integration/list-all', (body, ctx) =>
      this.automationService.listIntegrations(body, ctx))
    this.dispatcher.registerHandler('flow-tag/list-all', (body, ctx) =>
      this.automationService.listFlowTags(body, ctx))
    this.dispatcher.registerHandler('flow/show', (body, ctx) =>
      this.automationService.showFlow(body, ctx))

    // Phase 2 additive flow commands.
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

    // Phase 3 trigger configuration. Runtime remains feature-flagged.
    this.dispatcher.registerHandler('trigger/list', (body, ctx) =>
      this.triggerService.list(body, ctx))
    this.dispatcher.registerHandler('trigger/create', (body, ctx) =>
      this.triggerService.create(body, ctx))
    this.dispatcher.registerHandler('trigger/update', (body, ctx) =>
      this.triggerService.update(body, ctx))
    this.dispatcher.registerHandler('trigger/delete', (body, ctx) =>
      this.triggerService.remove(body, ctx))

    // Phase 5 sequence/drip.
    this.dispatcher.registerHandler('sequence/list', (body, ctx) =>
      this.sequenceService.list(body, ctx))
    this.dispatcher.registerHandler('sequence/create', (body, ctx) =>
      this.sequenceService.create(body, ctx))
    this.dispatcher.registerHandler('sequence/update', (body, ctx) =>
      this.sequenceService.update(body, ctx))
    this.dispatcher.registerHandler('sequence/step-upsert', (body, ctx) =>
      this.sequenceService.upsertStep(body, ctx))
    this.dispatcher.registerHandler('sequence/publish', (body, ctx) =>
      this.sequenceService.publish(body, ctx))
    this.dispatcher.registerHandler('sequence/pause', (body, ctx) =>
      this.sequenceService.pause(body, ctx))
    this.dispatcher.registerHandler('sequence/resume', (body, ctx) =>
      this.sequenceService.resume(body, ctx))
    this.dispatcher.registerHandler('sequence/enroll', (body, ctx) =>
      this.sequenceService.enroll(body, ctx))
    this.dispatcher.registerHandler('sequence/unenroll', (body, ctx) =>
      this.sequenceService.unenroll(body, ctx))

    // Phase 6 broadcast execution. Existing broadcast/list is untouched.
    this.dispatcher.registerHandler('broadcast/create', (body, ctx) =>
      this.broadcastRuntime.create(body, ctx))
    this.dispatcher.registerHandler('broadcast/update', (body, ctx) =>
      this.broadcastRuntime.update(body, ctx))
    this.dispatcher.registerHandler('broadcast/dry-run', (body, ctx) =>
      this.broadcastRuntime.dryRun(body, ctx))
    this.dispatcher.registerHandler('broadcast/schedule', (body, ctx) =>
      this.broadcastRuntime.schedule(body, ctx))
    this.dispatcher.registerHandler('broadcast/cancel', (body, ctx) =>
      this.broadcastRuntime.cancel(body, ctx))


    // Phase 8 safe integration capability catalog. New transports remain reference-only
    // until a real Customer Care ingress adapter exists; protected Zalo/FB are untouched.
    this.dispatcher.registerHandler('integration/capabilities', () =>
      ({ items: this.channelCapabilities.list() }))

    // Phase 9 operational visibility and explicit recovery controls.
    this.dispatcher.registerHandler('automation/health', (body, ctx) =>
      this.ops.health(body, ctx))
    this.dispatcher.registerHandler('automation/metrics', (body, ctx) =>
      this.ops.metricsSnapshot(body, ctx))
    this.dispatcher.registerHandler('automation/execution-retry', (body, ctx) =>
      this.ops.retryExecution(body, ctx))
    this.dispatcher.registerHandler('automation/execution-cancel', (body, ctx) =>
      this.ops.cancelExecution(body, ctx))
    this.dispatcher.registerHandler('automation/action-retry', (body, ctx) =>
      this.ops.retryAction(body, ctx))
    this.dispatcher.registerHandler('automation/outbound-retry', (body, ctx) =>
      this.ops.retryOutbound(body, ctx))
  }
}
