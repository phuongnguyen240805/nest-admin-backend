import { Module } from '@nestjs/common';

import { LadiworkSeedStore } from './data/ladiwork-seed.store';
import { LadiworkDashboardService } from './services/ladiwork-dashboard.service';
import { LadiworkDealService } from './services/deal.service';
import { LadiworkFilterService } from './services/filter.service';
import { LadiworkPipelineService } from './services/pipeline.service';

@Module({
  providers: [
    LadiworkSeedStore,
    LadiworkDashboardService,
    LadiworkDealService,
    LadiworkFilterService,
    LadiworkPipelineService,
  ],
  exports: [
    LadiworkSeedStore,
    LadiworkDashboardService,
    LadiworkDealService,
    LadiworkFilterService,
    LadiworkPipelineService,
  ],
})
export class LadiworkModule {}
