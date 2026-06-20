import { BadRequestException, Injectable } from '@nestjs/common'

import {
  CrmCompanyService,
  CrmPersonService,
  getPrimaryEmail,
  getPrimaryPhone,
  isCrmEnabled,
} from '@liora/crm-core'
import type { CrmCompanyEntity, CrmPersonEntity } from '@liora/database/entities/crm'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { CustomerStatus } from './common/enums'
import {
  CompanyQueryDto,
  CreateCompanyDto,
  UpdateCompanyDto,
} from './dto/company.dto'
import {
  CreateCustomerDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from './dto/customer.dto'
import { CompanyService } from './services/company.service'
import { CustomerService } from './services/customer.service'

/** FE-compatible customer shape (matches CustomerItem contract) */
export interface CustomerFacadeItem {
  id: string | number
  name: string
  phone: string
  email: string
  status: CustomerStatus
  createdAt: Date
  updatedAt?: Date
  tags?: string[]
}

export interface CompanyFacadeItem {
  id: string | number
  name: string
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class CrmFacade {
  constructor(
    private readonly customerService: CustomerService,
    private readonly companyService: CompanyService,
    private readonly personService: CrmPersonService,
    private readonly crmCompanyService: CrmCompanyService,
  ) {}

  get isEnabled(): boolean {
    return isCrmEnabled()
  }

  // ── Customers ──────────────────────────────────────────────

  async listCustomers(
    dto: CustomerQueryDto,
  ): Promise<Pagination<CustomerFacadeItem>> {
    if (!this.isEnabled) {
      const result = await this.customerService.list(dto)
      return {
        ...result,
        items: result.items.map((c) => this.mapV1Customer(c)),
      }
    }

    const result = await this.personService.list({
      page: dto.page,
      pageSize: dto.pageSize,
      search: dto.search,
      status: dto.status,
    })
    return {
      ...result,
      items: result.items.map((p) => this.mapPerson(p)),
    }
  }

  async detailCustomer(id: string): Promise<CustomerFacadeItem> {
    if (!this.isEnabled) {
      const customer = await this.customerService.detail(this.parseV1Id(id))
      return this.mapV1Customer({ ...customer, tags: customer.tags })
    }

    const person = await this.personService.detail(id)
    return this.mapPerson(person)
  }

  async createCustomer(dto: CreateCustomerDto): Promise<CustomerFacadeItem> {
    if (!this.isEnabled) {
      const customer = await this.customerService.create(dto)
      return this.mapV1Customer(customer)
    }

    const person = await this.personService.create({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      status: dto.status,
    })
    return this.mapPerson(person)
  }

  async updateCustomer(
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerFacadeItem> {
    if (!this.isEnabled) {
      const customer = await this.customerService.update(this.parseV1Id(id), dto)
      return this.mapV1Customer(customer)
    }

    const person = await this.personService.update(id, {
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      status: dto.status,
    })
    return this.mapPerson(person)
  }

  async removeCustomer(id: string): Promise<void> {
    if (!this.isEnabled) {
      await this.customerService.remove(this.parseV1Id(id))
      return
    }
    await this.personService.remove(id)
  }

  // ── Companies ──────────────────────────────────────────────

  async listCompanies(
    dto: CompanyQueryDto,
  ): Promise<Pagination<CompanyFacadeItem>> {
    if (!this.isEnabled) {
      const result = await this.companyService.list(dto)
      return {
        ...result,
        items: result.items.map((c) => this.mapV1Company(c)),
      }
    }

    const result = await this.crmCompanyService.list({
      page: dto.page,
      pageSize: dto.pageSize,
      search: dto.search,
    })
    return {
      ...result,
      items: result.items.map((c) => this.mapCompany(c)),
    }
  }

  async detailCompany(id: string): Promise<CompanyFacadeItem> {
    if (!this.isEnabled) {
      return this.mapV1Company(await this.companyService.detail(this.parseV1Id(id)))
    }
    return this.mapCompany(await this.crmCompanyService.detail(id))
  }

  async createCompany(dto: CreateCompanyDto): Promise<CompanyFacadeItem> {
    if (!this.isEnabled) {
      return this.mapV1Company(await this.companyService.create(dto))
    }
    return this.mapCompany(await this.crmCompanyService.create({ name: dto.name }))
  }

  async updateCompany(
    id: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyFacadeItem> {
    if (!this.isEnabled) {
      return this.mapV1Company(
        await this.companyService.update(this.parseV1Id(id), dto),
      )
    }
    return this.mapCompany(
      await this.crmCompanyService.update(id, { name: dto.name }),
    )
  }

  async removeCompany(id: string): Promise<void> {
    if (!this.isEnabled) {
      await this.companyService.remove(this.parseV1Id(id))
      return
    }
    await this.crmCompanyService.remove(id)
  }

  // ── Mappers ──────────────────────────────────────────────

  private mapV1Customer(customer: {
    id: number
    name: string
    phone: string
    email?: string | null
    status: CustomerStatus
    createdAt: Date
    updatedAt?: Date
    tags?: string[]
  }): CustomerFacadeItem {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? '',
      status: customer.status as CustomerStatus,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      tags: customer.tags ?? [],
    }
  }

  private mapPerson(person: CrmPersonEntity): CustomerFacadeItem {
    return {
      id: person.id,
      name: person.name,
      phone: person.primaryPhone ?? getPrimaryPhone(person.phones) ?? '',
      email: person.primaryEmail ?? getPrimaryEmail(person.emails) ?? '',
      status: person.status as CustomerStatus,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
      tags: [],
    }
  }

  private mapV1Company(company: {
    id: number
    name: string
    createdAt: Date
    updatedAt: Date
  }): CompanyFacadeItem {
    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    }
  }

  private mapCompany(company: CrmCompanyEntity): CompanyFacadeItem {
    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    }
  }

  private parseV1Id(id: string): number {
    const parsed = Number.parseInt(id, 10)
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`Invalid legacy customer/company id: ${id}`)
    }
    return parsed
  }
}