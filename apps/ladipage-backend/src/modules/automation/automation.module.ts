import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DomainEventsModule } from '../domain-events/domain-events.module';

import {
  AutomationTriggerEntity,
  BroadcastEntity,
  FlowEntity,
  FlowExecutionEntity,
  FlowExecutionStepEntity,
  FlowTagEntity,
  IntegrationEntity,
} from './entities';
import { LadiflowGraphAdapterService } from './graph/ladiflow-graph-adapter.service';
import { LadiflowGraphValidatorService } from './graph/ladiflow-graph-validator.service';
import { FlowExecutionService } from './runtime/flow-execution.service';
import { AutomationService } from './services/automation.service';
import { AutomationTriggerService } from './triggers/automation-trigger.service';
import { AutomationTriggerShadowService } from './triggers/automation-trigger-shadow.service';
import { KeywordMatcherService } from './triggers/keyword-matcher.service';

@Module({
  imports: [
    DomainEventsModule,
    TypeOrmModule.forFeature([
      AutomationTriggerEntity,
      BroadcastEntity,
      FlowEntity,
      FlowExecutionEntity,
      FlowExecutionStepEntity,
      FlowTagEntity,
      IntegrationEntity,
    ]),
  ],
  providers: [
    AutomationService,
    LadiflowGraphAdapterService,
    LadiflowGraphValidatorService,
    FlowExecutionService,
    KeywordMatcherService,
    AutomationTriggerService,
    AutomationTriggerShadowService,
  ],
  exports: [
    TypeOrmModule,
    AutomationService,
    LadiflowGraphAdapterService,
    LadiflowGraphValidatorService,
    FlowExecutionService,
    AutomationTriggerService,
  ],
})
export class AutomationModule {}
