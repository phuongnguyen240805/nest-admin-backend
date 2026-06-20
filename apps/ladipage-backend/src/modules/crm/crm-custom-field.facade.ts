import { BadRequestException, Injectable } from '@nestjs/common'

import { CrmCustomFieldService, isCrmEnabled } from '@liora/crm-core'
import type { CrmCustomFieldDefEntity } from '@liora/database/entities/crm'
import { BillingService } from '@liora/nest-core/modules/billing/services/billing.service'
import { Organization } from '@liora/nest-core/modules/billing/entities/organization.entity'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import {
  CreateCustomFieldDto,
  CustomFieldQueryDto,
  UpdateCustomFieldDto,
} from './dto/custom-field.dto'
import { CustomerCustomFieldEntity } from './entities'
import { CrmCustomFieldService as LpCrmCustomFieldService } from './services/custom-field.service'

export interface CustomFieldFacadeItem {
  id: string | number
  fieldName: string
  displayName: string
  dataType: string
  description: string
  targetType?: string
  isRequired?: boolean
  options?: string[] | null
  createdAt?: Date
  updatedAt?: Date
}

@Injectable()
export class CrmCustomFieldFacade {
  constructor(
    private readonly lpCustomFieldService: LpCrmCustomFieldService,
    private readonly crmCustomFieldService: CrmCustomFieldService,
    private readonly billingService: BillingService,
  ) {}

  async list(dto: CustomFieldQueryDto): Promise<Pagination<CustomFieldFacadeItem>> {
    if (!isCrmEnabled()) {
      const result = await this.lpCustomFieldService.list(dto)
      return {
        ...result,
        items: result.items.map((f) => this.mapV1(f)),
      }
    }

    const result = await this.crmCustomFieldService.list({
      page: dto.page,
      pageSize: dto.pageSize,
      targetType: dto.targetType,
    })
    return {
      ...result,
      items: result.items.map((f) => this.mapV2(f)),
    }
  }

  async detail(id: string): Promise<CustomFieldFacadeItem> {
    if (!isCrmEnabled()) {
      return this.mapV1(await this.lpCustomFieldService.detail(this.parseV1Id(id)))
    }
    return this.mapV2(await this.crmCustomFieldService.detail(id))
  }

  async create(
    dto: CreateCustomFieldDto,
    org?: Organization,
  ): Promise<CustomFieldFacadeItem> {
    if (!isCrmEnabled()) {
      const field = await this.lpCustomFieldService.create(dto)
      return this.mapV1(field)
    }

    const billing = org ? await this.billingService.getCurrentBilling(org) : null
    const tier = billing?.subscriptionTier ?? 'free'

    const field = await this.crmCustomFieldService.create(
      {
        targetType: dto.targetType,
        fieldName: dto.fieldName,
        displayName: dto.displayName,
        dataType: dto.dataType,
        description: dto.description,
        options: dto.options,
        isRequired: dto.isRequired,
      },
      tier,
    )
    return this.mapV2(field)
  }

  async update(id: string, dto: UpdateCustomFieldDto): Promise<CustomFieldFacadeItem> {
    if (!isCrmEnabled()) {
      const field = await this.lpCustomFieldService.update(this.parseV1Id(id), dto)
      return this.mapV1(field)
    }
    const field = await this.crmCustomFieldService.update(id, {
      displayName: dto.displayName,
      dataType: dto.dataType,
      description: dto.description,
      options: dto.options,
      isRequired: dto.isRequired,
    })
    return this.mapV2(field)
  }

  async remove(id: string): Promise<void> {
    if (!isCrmEnabled()) {
      await this.lpCustomFieldService.remove(this.parseV1Id(id))
      return
    }
    await this.crmCustomFieldService.remove(id)
  }

  private mapV1(field: CustomerCustomFieldEntity): CustomFieldFacadeItem {
    return {
      id: field.id,
      fieldName: field.fieldName,
      displayName: field.displayName,
      dataType: field.dataType,
      description: field.description ?? '',
      options: field.options,
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
    }
  }

  private mapV2(field: CrmCustomFieldDefEntity): CustomFieldFacadeItem {
    return {
      id: field.id,
      fieldName: field.fieldName,
      displayName: field.displayName,
      dataType: field.dataType,
      description: field.description ?? '',
      targetType: field.targetType,
      isRequired: field.isRequired,
      options: field.options,
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
    }
  }

  private parseV1Id(id: string): number {
    const parsed = Number.parseInt(id, 10)
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`Invalid legacy custom field id: ${id}`)
    }
    return parsed
  }
}