import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'

import {
  CrmFieldDefinitionEntity,
  CrmObjectDefinitionEntity,
} from '@liora/database/entities/crm'
import type { CrmCustomFieldDataType } from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'
import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { getEnterpriseObjectLimit } from '../config/enterprise.config'
import {
  normalizeSlug,
  validateFieldDefinition,
  validateObjectDefinition,
} from '../utils/dynamic-record-validation'
import { CrmTenantScopedService } from './crm-tenant-scoped.service'

export interface ObjectListQuery {
  page?: number
  pageSize?: number
}

export interface CreateObjectInput {
  slug: string
  label: string
  description?: string | null
  fields?: CreateFieldInput[]
}

export interface UpdateObjectInput {
  label?: string
  description?: string | null
}

export interface CreateFieldInput {
  fieldSlug: string
  label: string
  dataType?: CrmCustomFieldDataType
  isRequired?: boolean
  options?: string[] | null
  position?: number
}

export interface UpdateFieldInput {
  label?: string
  dataType?: CrmCustomFieldDataType
  isRequired?: boolean
  options?: string[] | null
  position?: number
}

@Injectable()
export class CrmObjectDefinitionService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmObjectDefinitionEntity)
    private readonly objectRepository: Repository<CrmObjectDefinitionEntity>,
    @InjectRepository(CrmFieldDefinitionEntity)
    private readonly fieldRepository: Repository<CrmFieldDefinitionEntity>,
  ) {
    super(tenantContext)
  }

  async list(query: ObjectListQuery): Promise<Pagination<CrmObjectDefinitionEntity>> {
    const qb = this.objectRepository
      .createQueryBuilder('obj')
      .leftJoinAndSelect('obj.fields', 'fields')
      .where('obj.tenantId = :tenantId', { tenantId: this.requireTenantId() })
      .andWhere('obj.deletedAt IS NULL')
      .orderBy('obj.createdAt', 'DESC')
      .addOrderBy('fields.position', 'ASC')

    return paginate(qb, { page: query.page, pageSize: query.pageSize })
  }

  async detailBySlug(slug: string): Promise<CrmObjectDefinitionEntity> {
    const normalized = normalizeSlug(slug)
    return this.findOneForTenantOrFail(
      this.objectRepository,
      { slug: normalized },
      'Custom object not found',
    ).then(async (obj) => {
      const fields = await this.fieldRepository.find({
        where: { objectId: obj.id },
        order: { position: 'ASC' },
      })
      obj.fields = fields
      return obj
    })
  }

  async countActive(): Promise<number> {
    return this.objectRepository.count({
      where: { ...this.tenantWhere(), deletedAt: IsNull() },
    })
  }

  async assertObjectQuota(subscriptionTier: string | null | undefined): Promise<void> {
    const limit = getEnterpriseObjectLimit(subscriptionTier)
    if (limit === 0) {
      throw new ForbiddenException(
        'CRM custom objects require Enterprise plan or higher',
      )
    }
    if (limit > 0) {
      const count = await this.countActive()
      if (count >= limit) {
        throw new ForbiddenException(
          `Custom object limit reached (${limit} objects on ${subscriptionTier} plan)`,
        )
      }
    }
  }

  async create(
    input: CreateObjectInput,
    subscriptionTier?: string | null,
  ): Promise<CrmObjectDefinitionEntity> {
    await this.assertObjectQuota(subscriptionTier)
    validateObjectDefinition(input)

    const slug = normalizeSlug(input.slug)
    const existing = await this.objectRepository.findOne({
      where: { tenantId: this.requireTenantId(), slug, deletedAt: IsNull() },
    })
    if (existing) {
      throw new BadRequestException(`Object slug already exists: ${slug}`)
    }

    const saved = await this.objectRepository.save({
      tenantId: this.requireTenantId(),
      slug,
      label: input.label.trim(),
      description: input.description ?? null,
    })

    if (input.fields?.length) {
      saved.fields = []
      for (const field of input.fields) {
        saved.fields.push(await this.addField(saved.id, field))
      }
    }

    return this.detailBySlug(saved.slug)
  }

  async update(slug: string, input: UpdateObjectInput): Promise<CrmObjectDefinitionEntity> {
    const obj = await this.detailBySlug(slug)

    if (input.label !== undefined && !input.label.trim()) {
      throw new BadRequestException('label cannot be empty')
    }

    Object.assign(obj, {
      label: input.label ?? obj.label,
      description:
        input.description !== undefined ? input.description : obj.description,
    })

    await this.objectRepository.save(obj)
    return this.detailBySlug(obj.slug)
  }

  async remove(slug: string): Promise<void> {
    const obj = await this.detailBySlug(slug)
    await this.fieldRepository.delete({ objectId: obj.id })
    await this.objectRepository.softRemove(obj)
  }

  async addField(
    objectIdOrSlug: string,
    input: CreateFieldInput,
  ): Promise<CrmFieldDefinitionEntity> {
    const obj = await this.resolveObject(objectIdOrSlug)
    validateFieldDefinition(input)

    const fieldSlug = normalizeSlug(input.fieldSlug)
    const dup = await this.fieldRepository.findOne({
      where: { objectId: obj.id, fieldSlug },
    })
    if (dup) {
      throw new BadRequestException(`Field slug already exists: ${fieldSlug}`)
    }

    return this.fieldRepository.save({
      objectId: obj.id,
      fieldSlug,
      label: input.label.trim(),
      dataType: input.dataType ?? 'TEXT',
      isRequired: input.isRequired ?? false,
      options: input.options ?? null,
      position: input.position ?? 0,
    })
  }

  async updateField(
    objectIdOrSlug: string,
    fieldId: string,
    input: UpdateFieldInput,
  ): Promise<CrmFieldDefinitionEntity> {
    const obj = await this.resolveObject(objectIdOrSlug)
    const field = await this.fieldRepository.findOne({
      where: { id: fieldId, objectId: obj.id },
    })
    if (!field) {
      throw new BadRequestException('Field not found')
    }

    if (input.label !== undefined) {
      validateFieldDefinition({
        fieldSlug: field.fieldSlug,
        label: input.label,
        dataType: input.dataType ?? field.dataType,
        options: input.options !== undefined ? input.options : field.options,
      })
    }

    Object.assign(field, {
      label: input.label ?? field.label,
      dataType: input.dataType ?? field.dataType,
      isRequired: input.isRequired ?? field.isRequired,
      options: input.options !== undefined ? input.options : field.options,
      position: input.position ?? field.position,
    })

    return this.fieldRepository.save(field)
  }

  async removeField(objectIdOrSlug: string, fieldId: string): Promise<void> {
    const obj = await this.resolveObject(objectIdOrSlug)
    const field = await this.fieldRepository.findOne({
      where: { id: fieldId, objectId: obj.id },
    })
    if (!field) {
      throw new BadRequestException('Field not found')
    }
    await this.fieldRepository.delete(field.id)
  }

  private async resolveObject(idOrSlug: string): Promise<CrmObjectDefinitionEntity> {
    const byId = await this.findOneForTenant(this.objectRepository, { id: idOrSlug })
    if (byId) return byId
    return this.detailBySlug(idOrSlug)
  }
}