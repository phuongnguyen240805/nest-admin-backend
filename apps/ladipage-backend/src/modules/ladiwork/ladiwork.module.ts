import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LadiworkSeedStore } from './data/ladiwork-seed.store';
import {
  CrmDealEntity,
  CrmFilterEntity,
  CrmPipelineEntity,
  LadiworkDashboardEntity,
} from './entities';
import { LadiworkDashboardService } from './services/ladiwork-dashboard.service';
import { LadiworkDealService } from './services/deal.service';
import { LadiworkFilterService } from './services/filter.service';
import { LadiworkPipelineService } from './services/pipeline.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CrmDealEntity,
      CrmFilterEntity,
      CrmPipelineEntity,
      LadiworkDashboardEntity,
    ]),
  ],
  providers: [
    LadiworkSeedStore,
    LadiworkDashboardService,
    LadiworkDealService,
    LadiworkFilterService,
    LadiworkPipelineService,
  ],
  exports: [
    TypeOrmModule,
    LadiworkSeedStore,
    LadiworkDashboardService,
    LadiworkDealService,
    LadiworkFilterService,
    LadiworkPipelineService,
  ],
})
export class LadiworkModule {}
