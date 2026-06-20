import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import {
  CrmActivityEntity,
  CrmCustomFieldDefEntity,
  CrmCustomFieldValueEntity,
  CrmCompanyEntity,
  CrmDynamicRecordEntity,
  CrmFieldDefinitionEntity,
  CrmNoteEntity,
  CrmObjectDefinitionEntity,
  CrmOpportunityEntity,
  CrmPersonCompanyEntity,
  CrmPersonEntity,
  CrmPipelineEntity,
  CrmPipelineStageEntity,
  CrmTaskEntity,
} from '@liora/database/entities/crm'
import { TenantModule } from '@liora/nest-core'

import { CrmActivityService } from './services/activity.service'
import { CrmCustomFieldService } from './services/custom-field.service'
import { CrmCompanyService } from './services/company.service'
import { CrmNoteService } from './services/note.service'
import { CrmOpportunityService } from './services/opportunity.service'
import { CrmPersonService } from './services/person.service'
import { CrmPipelineService } from './services/pipeline.service'
import { CrmTaskService } from './services/task.service'
import { CrmObjectDefinitionService } from './services/object-definition.service'
import { CrmDynamicRecordService } from './services/dynamic-record.service'

@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forFeature([
      CrmPersonEntity,
      CrmCompanyEntity,
      CrmPersonCompanyEntity,
      CrmPipelineEntity,
      CrmPipelineStageEntity,
      CrmOpportunityEntity,
      CrmTaskEntity,
      CrmNoteEntity,
      CrmActivityEntity,
      CrmCustomFieldDefEntity,
      CrmCustomFieldValueEntity,
      CrmObjectDefinitionEntity,
      CrmFieldDefinitionEntity,
      CrmDynamicRecordEntity,
    ]),
  ],
  providers: [
    CrmActivityService,
    CrmCustomFieldService,
    CrmPipelineService,
    CrmPersonService,
    CrmCompanyService,
    CrmOpportunityService,
    CrmTaskService,
    CrmNoteService,
    CrmObjectDefinitionService,
    CrmDynamicRecordService,
  ],
  exports: [
    CrmActivityService,
    CrmCustomFieldService,
    CrmPipelineService,
    CrmPersonService,
    CrmCompanyService,
    CrmOpportunityService,
    CrmTaskService,
    CrmNoteService,
    CrmObjectDefinitionService,
    CrmDynamicRecordService,
    TypeOrmModule,
  ],
})
export class CrmCoreModule {}