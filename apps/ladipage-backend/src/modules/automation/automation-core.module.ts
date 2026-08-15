import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { DomainEventsModule } from '../domain-events/domain-events.module'
import { AutomationActionDispatchService } from './actions/automation-action-dispatch.service'
import { AutomationHttpActionService } from './actions/automation-http-action.service'
import {
  AutomationActionDispatchEntity,
  AutomationBroadcastRecipientEntity,
  AutomationOutboundDispatchEntity,
  AutomationSequenceDispatchEntity,
  AutomationSequenceEnrollmentEntity,
  AutomationSequenceEntity,
  AutomationSequenceStepEntity,
  AutomationTriggerEntity,
  BroadcastEntity,
  FlowEntity,
  FlowExecutionEntity,
  FlowExecutionStepEntity,
  FlowTagEntity,
  IntegrationEntity,
} from './entities'
import { AutomationBroadcastAudienceService } from './broadcast/automation-broadcast-audience.service'
import { AutomationBroadcastRuntimeService } from './broadcast/automation-broadcast-runtime.service'
import { LadiflowGraphAdapterService } from './graph/ladiflow-graph-adapter.service'
import { LadiflowGraphValidatorService } from './graph/ladiflow-graph-validator.service'
import { AutomationConditionExecutor } from './runtime/executors/condition.executor'
import { AutomationActionExecutor } from './runtime/executors/action.executor'
import { AutomationControlExecutor } from './runtime/executors/control.executor'
import { AutomationSendMessageExecutor } from './runtime/executors/send-message.executor'
import { AutomationSetVariableExecutor } from './runtime/executors/set-variable.executor'
import { AutomationWaitForReplyExecutor } from './runtime/executors/wait-for-reply.executor'
import { AutomationWaitExecutor } from './runtime/executors/wait.executor'
import { AutomationSplitTrafficExecutor } from './runtime/executors/split-traffic.executor'
import { AutomationConditionEvaluatorService } from './runtime/condition-evaluator.service'
import { FlowExecutionService } from './runtime/flow-execution.service'
import { FlowNodeExecutorRegistry } from './runtime/flow-node-executor.registry'
import { FlowRuntimeService } from './runtime/flow-runtime.service'
import { AutomationSequenceService } from './sequence/automation-sequence.service'
import { AutomationSequenceTimeService } from './sequence/automation-sequence-time.service'
import { AutomationOutboundDispatchService } from './services/automation-outbound-dispatch.service'
import { AutomationService } from './services/automation.service'
import { AutomationTriggerService } from './triggers/automation-trigger.service'
import { AutomationMessageNormalizerService } from './integrations/automation-message-normalizer.service'
import { AutomationChannelCapabilityService } from './integrations/automation-channel-capability.service'
import { AutomationMetricsService } from './observability/automation-metrics.service'
import { AutomationOpsService } from './observability/automation-ops.service'
import { KeywordMatcherService } from './triggers/keyword-matcher.service'

export const AUTOMATION_ENTITIES = [
  AutomationActionDispatchEntity,
  AutomationBroadcastRecipientEntity,
  AutomationOutboundDispatchEntity,
  AutomationSequenceDispatchEntity,
  AutomationSequenceEnrollmentEntity,
  AutomationSequenceEntity,
  AutomationSequenceStepEntity,
  AutomationTriggerEntity,
  BroadcastEntity,
  FlowEntity,
  FlowExecutionEntity,
  FlowExecutionStepEntity,
  FlowTagEntity,
  IntegrationEntity,
]

const CORE_PROVIDERS = [
  AutomationActionDispatchService,
  AutomationHttpActionService,
  AutomationMessageNormalizerService,
  AutomationChannelCapabilityService,
  AutomationMetricsService,
  AutomationOpsService,
  AutomationService,
  LadiflowGraphAdapterService,
  LadiflowGraphValidatorService,
  FlowExecutionService,
  AutomationConditionEvaluatorService,
  AutomationOutboundDispatchService,
  AutomationSequenceTimeService,
  AutomationSequenceService,
  AutomationBroadcastAudienceService,
  AutomationBroadcastRuntimeService,
  KeywordMatcherService,
  AutomationTriggerService,
  AutomationSendMessageExecutor,
  AutomationActionExecutor,
  AutomationSplitTrafficExecutor,
  AutomationConditionExecutor,
  AutomationSetVariableExecutor,
  AutomationWaitExecutor,
  AutomationWaitForReplyExecutor,
  AutomationControlExecutor,
  FlowNodeExecutorRegistry,
  FlowRuntimeService,
]

@Module({
  imports: [DomainEventsModule, TypeOrmModule.forFeature(AUTOMATION_ENTITIES)],
  providers: CORE_PROVIDERS,
  exports: [DomainEventsModule, TypeOrmModule, ...CORE_PROVIDERS],
})
export class AutomationCoreModule {}
