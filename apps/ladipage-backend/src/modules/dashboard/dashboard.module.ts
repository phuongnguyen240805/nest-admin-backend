import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BillingModule, TenantModule } from '@liora/nest-core'

import { CustomerEntity } from '../crm/entities/customer.entity'
import { SegmentEntity } from '../crm/entities/segment.entity'
import { OrderEntity } from '../ecom-store/entities/order.entity'
import { ProductEntity } from '../ecom-store/entities/product.entity'

import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  imports: [
    TenantModule,
    BillingModule,
    TypeOrmModule.forFeature([
      OrderEntity,
      ProductEntity,
      CustomerEntity,
      SegmentEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}