import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TenantModule } from '@liora/nest-core'

import { CustomerEntity } from '../crm/entities/customer.entity'
import { CustomerSegmentEntity } from '../crm/entities/customer-segment.entity'
import { SegmentEntity } from '../crm/entities/segment.entity'
import { OrderEntity } from '../ecom-store/entities/order.entity'
import { OrderItemEntity } from '../ecom-store/entities/order-item.entity'
import { ProductEntity } from '../ecom-store/entities/product.entity'

import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'

@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
      CustomerEntity,
      SegmentEntity,
      CustomerSegmentEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}