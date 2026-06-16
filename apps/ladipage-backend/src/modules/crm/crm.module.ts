import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { TenantModule } from '@liora/nest-core'

import { CompanyController } from './controllers/company.controller'
import { CrmCustomFieldController } from './controllers/custom-field.controller'
import { CustomerController } from './controllers/customer.controller'
import { ErrorLogController } from './controllers/error-log.controller'
import { SegmentController } from './controllers/segment.controller'
import { CrmTagController } from './controllers/tag.controller'
import {
  CompanyEntity,
  CustomerCompanyEntity,
  CustomerCustomFieldEntity,
  CustomerEntity,
  CustomerFieldValueEntity,
  CustomerSegmentEntity,
  CustomerTagEntity,
  CustomerTagMapEntity,
  SegmentEntity,
  SyncErrorLogEntity,
} from './entities'
import { CompanyService } from './services/company.service'
import { CrmCustomFieldService } from './services/custom-field.service'
import { CustomerService } from './services/customer.service'
import { ErrorLogService } from './services/error-log.service'
import { SegmentService } from './services/segment.service'
import { CrmTagService } from './services/tag.service'

@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forFeature([
      CustomerEntity,
      CompanyEntity,
      CustomerCompanyEntity,
      SegmentEntity,
      CustomerSegmentEntity,
      CustomerTagEntity,
      CustomerTagMapEntity,
      CustomerCustomFieldEntity,
      CustomerFieldValueEntity,
      SyncErrorLogEntity,
    ]),
  ],
  controllers: [
    CustomerController,
    CompanyController,
    SegmentController,
    CrmTagController,
    CrmCustomFieldController,
    ErrorLogController,
  ],
  providers: [
    CustomerService,
    CompanyService,
    SegmentService,
    CrmTagService,
    CrmCustomFieldService,
    ErrorLogService,
  ],
  exports: [CustomerService, TypeOrmModule],
})
export class CrmModule {}