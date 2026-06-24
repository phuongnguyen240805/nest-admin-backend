import { Injectable, OnModuleInit } from '@nestjs/common';

import { LadiflowDispatcherService } from '../ladiflow-rpc/ladiflow-dispatcher.service';
import { LadiworkDashboardService } from './services/ladiwork-dashboard.service';
import { LadiworkDealService } from './services/deal.service';
import { LadiworkFilterService } from './services/filter.service';
import { LadiworkPipelineService } from './services/pipeline.service';

@Injectable()
export class LadiworkRpcRegistrar implements OnModuleInit {
  constructor(
    private readonly dispatcher: LadiflowDispatcherService,
    private readonly pipelineService: LadiworkPipelineService,
    private readonly dealService: LadiworkDealService,
    private readonly dashboardService: LadiworkDashboardService,
    private readonly filterService: LadiworkFilterService,
  ) {}

  onModuleInit(): void {
    this.dispatcher.registerHandler('crm-pipeline/list', (body, ctx) =>
      this.pipelineService.list(body, ctx));
    this.dispatcher.registerHandler('crm-pipeline/search', (body, ctx) =>
      this.pipelineService.search(body, ctx));
    this.dispatcher.registerHandler('crm-deal/list', (body, ctx) =>
      this.dealService.listByStage(body, ctx));
    this.dispatcher.registerHandler('crm-deal/get-summary', (body, ctx) =>
      this.dealService.getSummary(body, ctx));
    this.dispatcher.registerHandler('ladiwork-dashboard/config', () =>
      this.dashboardService.config());
    this.dispatcher.registerHandler('crm-filter/get-system-filters', () =>
      this.filterService.getSystemFilters());
  }
}
