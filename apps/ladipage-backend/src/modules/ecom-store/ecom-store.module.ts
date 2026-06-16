import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { TenantModule } from '@liora/nest-core'

import { CrmModule } from '../crm/crm.module'

import { CategoryController } from './controllers/category.controller'
import { CustomFieldController } from './controllers/custom-field.controller'
import { DeliveryNoteController } from './controllers/delivery-note.controller'
import { InventoryController } from './controllers/inventory.controller'
import { OrderController } from './controllers/order.controller'
import { ProductController } from './controllers/product.controller'
import { ReviewController } from './controllers/review.controller'
import { TagController } from './controllers/tag.controller'
import {
  CustomFieldEntity,
  DeliveryNoteEntity,
  OrderEntity,
  OrderItemEntity,
  OrderTagEntity,
  OrderTagMapEntity,
  ProductCategoryEntity,
  ProductEntity,
  ProductReviewEntity,
  ProductTagEntity,
  ProductTagMapEntity,
} from './entities'
import { CategoryService } from './services/category.service'
import { EcomCustomFieldService } from './services/custom-field.service'
import { DeliveryNoteService } from './services/delivery-note.service'
import { InventoryService } from './services/inventory.service'
import { OrderService } from './services/order.service'
import { ProductService } from './services/product.service'
import { ReviewService } from './services/review.service'
import { EcomTagService } from './services/tag.service'

@Module({
  imports: [
    TenantModule,
    CrmModule,
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductCategoryEntity,
      ProductTagEntity,
      ProductTagMapEntity,
      OrderEntity,
      OrderItemEntity,
      OrderTagEntity,
      OrderTagMapEntity,
      DeliveryNoteEntity,
      ProductReviewEntity,
      CustomFieldEntity,
    ]),
  ],
  controllers: [
    OrderController,
    ProductController,
    CategoryController,
    TagController,
    InventoryController,
    ReviewController,
    CustomFieldController,
    DeliveryNoteController,
  ],
  providers: [
    OrderService,
    ProductService,
    CategoryService,
    EcomTagService,
    InventoryService,
    ReviewService,
    EcomCustomFieldService,
    DeliveryNoteService,
  ],
  exports: [TypeOrmModule],
})
export class EcomStoreModule {}