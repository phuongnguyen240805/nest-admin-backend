import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, DataSource, EntityManager, IsNull, Repository } from 'typeorm'

import {
  CrmPersonEntity,
  CrmPersonStatus,
} from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'
import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { isLikelyCompanyEmail } from '../utils/email-domain'
import { parseName } from '../utils/parse-name'
import {
  getPrimaryEmail,
  getPrimaryPhone,
  normalizeEmail,
  normalizePhone,
  toEmailEntries,
  toPhoneEntries,
} from '../utils/contact-entries'
import { CrmActivityService } from './activity.service'
import { CrmCompanyService } from './company.service'
import { CrmTenantScopedService } from './crm-tenant-scoped.service'

export interface PersonListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: CrmPersonStatus
}

export interface FindOrCreatePersonInput {
  name: string
  phone?: string | null
  email?: string | null
}

export interface CreatePersonInput extends FindOrCreatePersonInput {
  status?: CrmPersonStatus
  jobTitle?: string | null
  companyIds?: string[]
}

export interface UpdatePersonInput {
  name?: string
  phone?: string | null
  email?: string | null
  status?: CrmPersonStatus
  jobTitle?: string | null
  companyIds?: string[]
}

@Injectable()
export class CrmPersonService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmPersonEntity)
    private readonly personRepository: Repository<CrmPersonEntity>,
    private readonly companyService: CrmCompanyService,
    private readonly activityService: CrmActivityService,
    private readonly dataSource: DataSource,
  ) {
    super(tenantContext)
  }

  async countActive(): Promise<number> {
    return this.personRepository.count({
      where: { ...this.tenantWhere(), deletedAt: IsNull() },
    })
  }

  async countCreatedBetween(from: Date, to: Date): Promise<number> {
    return this.personRepository.count({
      where: {
        ...this.tenantWhere(),
        deletedAt: IsNull(),
        createdAt: Between(from, to),
      },
    })
  }

  async aggregateCreatedByDay(
    from: Date,
    to: Date,
  ): Promise<Array<{ day: string; count: string | number }>> {
    const tenantId = this.requireTenantId()
    return this.personRepository
      .createQueryBuilder('person')
      .select("TO_CHAR(person.created_at, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(person.id)', 'count')
      .where('person.tenantId = :tenantId', { tenantId })
      .andWhere('person.deleted_at IS NULL')
      .andWhere('person.created_at BETWEEN :from AND :to', { from, to })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany()
  }

  async list(query: PersonListQuery): Promise<Pagination<CrmPersonEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.personRepository
      .createQueryBuilder('person')
      .where('person.tenantId = :tenantId', { tenantId })
      .andWhere('person.deletedAt IS NULL')

    if (query.search) {
      qb.andWhere(
        `(person.name ILIKE :search
          OR person.primary_email ILIKE :search
          OR person.primary_phone ILIKE :search)`,
        { search: `%${query.search}%` },
      )
    }

    if (query.status) {
      qb.andWhere('person.status = :status', { status: query.status })
    }

    qb.orderBy('person.createdAt', 'DESC')
    return paginate(qb, { page: query.page, pageSize: query.pageSize })
  }

  async detail(id: string, manager?: EntityManager): Promise<CrmPersonEntity> {
    const repo = manager
      ? manager.getRepository(CrmPersonEntity)
      : this.personRepository

    return this.findOneForTenantOrFail(repo, { id }, 'Person not found')
  }

  async create(input: CreatePersonInput): Promise<CrmPersonEntity> {
    const tenantId = this.requireTenantId()

    return this.dataSource.transaction(async (manager) => {
      const parsed = parseName(input.name)
      const emails = toEmailEntries(input.email)
      const phones = toPhoneEntries(input.phone)

      const person = await manager.getRepository(CrmPersonEntity).save({
        tenantId,
        name: parsed.fullName || input.name,
        firstName: parsed.firstName || null,
        lastName: parsed.lastName || null,
        emails,
        phones,
        primaryEmail: getPrimaryEmail(emails),
        primaryPhone: getPrimaryPhone(phones),
        jobTitle: input.jobTitle ?? null,
        status: input.status ?? 'ACTIVE',
      })

      await this.autoLinkCompany(manager, person, input.email)
      if (input.companyIds?.length) {
        for (const companyId of input.companyIds) {
          await this.companyService.linkPersonToCompany(
            person.id,
            companyId,
            manager,
          )
        }
      }

      await this.activityService.log(
        {
          name: `Person created: ${person.name}`,
          action: 'CREATED',
          targetType: 'person',
          targetId: person.id,
          personId: person.id,
        },
        manager,
      )

      return this.detail(person.id, manager)
    })
  }

  async update(id: string, input: UpdatePersonInput): Promise<CrmPersonEntity> {
    const person = await this.detail(id)

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CrmPersonEntity)
      const updates: Partial<CrmPersonEntity> = {}

      if (input.name !== undefined) {
        const parsed = parseName(input.name)
        updates.name = parsed.fullName || input.name
        updates.firstName = parsed.firstName || null
        updates.lastName = parsed.lastName || null
      }

      if (input.email !== undefined) {
        const emails = toEmailEntries(input.email)
        updates.emails = emails
        updates.primaryEmail = getPrimaryEmail(emails)
      }

      if (input.phone !== undefined) {
        const phones = toPhoneEntries(input.phone)
        updates.phones = phones
        updates.primaryPhone = getPrimaryPhone(phones)
      }

      if (input.status !== undefined) updates.status = input.status
      if (input.jobTitle !== undefined) updates.jobTitle = input.jobTitle

      await repo.update(person.id, updates)

      if (input.email !== undefined) {
        const updated = await this.detail(id, manager)
        await this.autoLinkCompany(manager, updated, input.email)
      }

      await this.activityService.log(
        {
          name: `Person updated: ${person.name}`,
          action: 'UPDATED',
          targetType: 'person',
          targetId: person.id,
          personId: person.id,
          properties: { changes: input },
        },
        manager,
      )

      return this.detail(id, manager)
    })
  }

  async remove(id: string): Promise<void> {
    const person = await this.detail(id)

    await this.dataSource.transaction(async (manager) => {
      await this.activityService.log(
        {
          name: `Person deleted: ${person.name}`,
          action: 'DELETED',
          targetType: 'person',
          targetId: person.id,
          personId: person.id,
        },
        manager,
      )
      await manager.getRepository(CrmPersonEntity).softRemove(person)
    })
  }

  /**
   * Twenty-inspired dedup: phone → email → create.
   * Auto-suggest/link company from corporate email domain.
   */
  async findOrCreateByContact(
    input: FindOrCreatePersonInput,
  ): Promise<CrmPersonEntity> {
    const tenantId = this.requireTenantId()
    const normPhone = normalizePhone(input.phone)
    const normEmail = normalizeEmail(input.email)

    if (normPhone) {
      const byPhone = await this.personRepository
        .createQueryBuilder('person')
        .where('person.tenantId = :tenantId', { tenantId })
        .andWhere('person.deletedAt IS NULL')
        .andWhere(
          `regexp_replace(person.primary_phone, '[^0-9]', '', 'g') = :normPhone`,
          { normPhone },
        )
        .getOne()

      if (byPhone) return byPhone
    }

    if (normEmail) {
      const byEmail = await this.personRepository.findOne({
        where: { tenantId, primaryEmail: normEmail },
      })
      if (byEmail) return byEmail
    }

    return this.dataSource.transaction(async (manager) => {
      const parsed = parseName(input.name)
      const emails = toEmailEntries(input.email)
      const phones = toPhoneEntries(input.phone)

      const person = await manager.getRepository(CrmPersonEntity).save({
        tenantId,
        name: parsed.fullName || input.name,
        firstName: parsed.firstName || null,
        lastName: parsed.lastName || null,
        emails,
        phones,
        primaryEmail: normEmail,
        primaryPhone: input.phone?.trim() || null,
        status: 'ACTIVE',
      })

      await this.autoLinkCompany(manager, person, input.email)
      return person
    })
  }

  private async autoLinkCompany(
    manager: EntityManager,
    person: CrmPersonEntity,
    email?: string | null,
  ): Promise<void> {
    if (!email || !isLikelyCompanyEmail(email)) return

    const company = await this.companyService.findOrCreateByEmailDomain(
      email,
      manager,
    )
    if (!company) return

    await this.companyService.linkPersonToCompany(
      person.id,
      company.id,
      manager,
    )
  }
}