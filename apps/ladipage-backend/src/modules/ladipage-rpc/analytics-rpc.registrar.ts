import { Injectable, OnModuleInit } from '@nestjs/common'

import { AnalyticsReportRpcService } from '../analytics/analytics-report-rpc.service'
import { RpcDispatcherService } from './rpc-dispatcher.service'

@Injectable()
export class AnalyticsRpcRegistrar implements OnModuleInit {
  constructor(
    private readonly dispatcher: RpcDispatcherService,
    private readonly reportService: AnalyticsReportRpcService,
  ) {}

  onModuleInit(): void {
    this.dispatcher.registerHandler('report/overview', (body, ctx) =>
      this.reportService.overview(body, ctx))
    this.dispatcher.registerHandler('report/top-product', (body, ctx) =>
      this.reportService.topProduct(body, ctx))
  }
}
