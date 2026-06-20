import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { CrmCoreModule } from '@liora/crm-core'
import { BillingModule, TenantModule } from '@liora/nest-core'

import { ActivityController } from './controllers/activity.controller'
import { CompanyController } from './controllers/company.controller'
import { CrmCustomFieldController } from './controllers/custom-field.controller'
import { CustomerController } from './controllers/customer.controller'
import { ErrorLogController } from './controllers/error-log.controller'
import { NoteController } from './controllers/note.controller'
import { OpportunityController } from './controllers/opportunity.controller'
import { PipelineController } from './controllers/pipeline.controller'
import { SegmentController } from './controllers/segment.controller'
import { CrmTagController } from './controllers/tag.controller'
import { TaskController } from './controllers/task.controller'
import { CrmObjectController } from './controllers/object.controller'
import { CrmDynamicRecordController } from './controllers/dynamic-record.controller'
import { CrmEnabledGuard } from './guards/crm-enabled.guard'
import { EnterpriseGuard } from './guards/enterprise.guard'
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
import { CrmCustomFieldFacade } from './crm-custom-field.facade'
import { CrmFacade } from './crm.facade'
import { CompanyService } from './services/company.service'
import { CrmCustomFieldService } from './services/custom-field.service'
import { CustomerService } from './services/customer.service'
import { ErrorLogService } from './services/error-log.service'
import { SegmentService } from './services/segment.service'
import { CrmTagService } from './services/tag.service'

@Module({
  imports: [
    TenantModule,
    BillingModule,
    CrmCoreModule,
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
    OpportunityController,
    PipelineController,
    TaskController,
    NoteController,
    ActivityController,
    SegmentController,
    CrmTagController,
    CrmCustomFieldController,
    ErrorLogController,
    CrmObjectController,
    CrmDynamicRecordController,
  ],
  providers: [
    CrmEnabledGuard,
    EnterpriseGuard,
    CrmFacade,
    CrmCustomFieldFacade,
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