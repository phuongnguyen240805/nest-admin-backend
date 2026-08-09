import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { CrmCoreModule } from '@liora/crm-core'
import { TenantModule } from '@liora/nest-core'

import { CrmModule } from '../crm/crm.module'

import { CategoryController } from './controllers/category.controller'
import { CustomFieldController } from './controllers/custom-field.controller'
import { DeliveryNoteController } from './controllers/delivery-note.controller'
import { InventoryController } from './controllers/inventory.controller'
import { OrderController } from './controllers/order.controller'
import { ProductController } from './controllers/product.controller'
import { ReviewController } from './controllers/review.controller'
import { ReviewGlobalController } from './controllers/review-global.controller'
import { ShippingController } from './controllers/shipping.controller'
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
  ShipmentEntity,
  ShipmentEventEntity,
  ShippingIntegrationEntity,
} from './entities'
import { CategoryService } from './services/category.service'
import { EcomCustomFieldService } from './services/custom-field.service'
import { DeliveryNoteService } from './services/delivery-note.service'
import { InventoryService } from './services/inventory.service'
import { OrderCustomerResolver } from './services/order-customer.resolver'
import { OrderService } from './services/order.service'
import { ProductService } from './services/product.service'
import { ReviewService } from './services/review.service'
import { EcomTagService } from './services/tag.service'
import { ShippingAdapterRegistry } from './shipping/shipping-adapter.registry'
import { ShippingCredentialVaultService } from './shipping/shipping-credential-vault.service'
import { ShippingIntegrationService } from './shipping/shipping-integration.service'
import { ShippingService } from './shipping/shipping.service'

@Module({
  imports: [
    TenantModule,
    CrmCoreModule,
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
      ShippingIntegrationEntity,
      ShipmentEntity,
      ShipmentEventEntity,
    ]),
  ],
  controllers: [
    OrderController,
    ProductController,
    CategoryController,
    TagController,
    InventoryController,
    ReviewController,
    ReviewGlobalController,
    CustomFieldController,
    DeliveryNoteController,
    ShippingController,
  ],
  providers: [
    OrderCustomerResolver,
    OrderService,
    ProductService,
    CategoryService,
    EcomTagService,
    InventoryService,
    ReviewService,
    EcomCustomFieldService,
    DeliveryNoteService,
    ShippingAdapterRegistry,
    ShippingCredentialVaultService,
    ShippingIntegrationService,
    ShippingService,
  ],
  exports: [TypeOrmModule, ShippingIntegrationService, ShippingService],
})
export class EcomStoreModule {}
