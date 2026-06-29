import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CrmCoreModule } from '@liora/crm-core'
import { TenantModule } from '@liora/nest-core'

import { CustomerEntity } from '../crm/entities/customer.entity'
import { CustomerSegmentEntity } from '../crm/entities/customer-segment.entity'
import { SegmentEntity } from '../crm/entities/segment.entity'
import { OrderEntity } from '../ecom-store/entities/order.entity'
import { OrderItemEntity } from '../ecom-store/entities/order-item.entity'
import { ProductEntity } from '../ecom-store/entities/product.entity'
import { AnalyticsReportEntity } from './entities'

import { AnalyticsController } from './analytics.controller'
import { AnalyticsReportRpcService } from './analytics-report-rpc.service'
import { AnalyticsService } from './analytics.service'

@Module({
  imports: [
    TenantModule,
    CrmCoreModule,
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
      AnalyticsReportEntity,
      CustomerEntity,
      SegmentEntity,
      CustomerSegmentEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsReportRpcService, AnalyticsService],
  exports: [AnalyticsReportRpcService, AnalyticsService],
})
export class AnalyticsModule {}
