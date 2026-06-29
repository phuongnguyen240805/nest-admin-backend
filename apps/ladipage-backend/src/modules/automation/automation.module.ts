import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  BroadcastEntity,
  FlowEntity,
  FlowTagEntity,
  IntegrationEntity,
} from './entities';
import { AutomationService } from './services/automation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BroadcastEntity,
      FlowEntity,
      FlowTagEntity,
      IntegrationEntity,
    ]),
  ],
  providers: [AutomationService],
  exports: [TypeOrmModule, AutomationService],
})
export class AutomationModule {}
