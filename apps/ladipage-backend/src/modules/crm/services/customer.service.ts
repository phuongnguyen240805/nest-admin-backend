import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, In, Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { CustomerStatus } from '../common/enums'
import {
  CreateCustomerDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from '../dto/customer.dto'
import {
  CustomerCompanyEntity,
  CustomerEntity,
  CustomerSegmentEntity,
  CustomerTagEntity,
  CustomerTagMapEntity,
} from '../entities'

export interface FindOrCreateCustomerInput {
  name: string
  phone: string
  email?: string | null
}

@Injectable()
export class CustomerService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CustomerEntity)
    private readonly customerRepository: Repository<CustomerEntity>,
    @InjectRepository(CustomerTagMapEntity)
    private readonly tagMapRepository: Repository<CustomerTagMapEntity>,
    @InjectRepository(CustomerTagEntity)
    private readonly tagRepository: Repository<CustomerTagEntity>,
    @InjectRepository(CustomerSegmentEntity)
    private readonly segmentMapRepository: Repository<CustomerSegmentEntity>,
    @InjectRepository(CustomerCompanyEntity)
    private readonly companyMapRepository: Repository<CustomerCompanyEntity>,
    private readonly dataSource: DataSource,
  ) {
    super(tenantContext)
  }

  async list(dto: CustomerQueryDto): Promise<Pagination<CustomerEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.tenantId = :tenantId', { tenantId })

    if (dto.search) {
      qb.andWhere(
        '(customer.name ILIKE :search OR customer.phone ILIKE :search OR customer.email ILIKE :search)',
        { search: `%${dto.search}%` },
      )
    }

    if (dto.status) {
      qb.andWhere('customer.status = :status', { status: dto.status })
    }

    qb.orderBy('customer.createdAt', 'DESC')

    return paginate(qb, { page: dto.page, pageSize: dto.pageSize })
  }

  async detail(id: number, manager?: EntityManager) {
    const customerRepository = manager
      ? manager.getRepository(CustomerEntity)
      : this.customerRepository

    const customer = await this.findOneForTenantOrFail(
      customerRepository,
      { id },
      'Customer not found',
    )
    const tags = await this.getCustomerTags(id, manager)
    return { ...customer, tags }
  }

  async create(dto: CreateCustomerDto) {
    const tenantId = this.requireTenantId()

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(CustomerEntity).save({
        tenantId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
        status: dto.status ?? CustomerStatus.ACTIVE,
      })

      await this.syncRelations(manager, customer.id, dto)
      return this.detail(customer.id, manager)
    })
  }

  async update(id: number, dto: UpdateCustomerDto) {
    const customer = await this.findOneForTenantOrFail(
      this.customerRepository,
      { id },
      'Customer not found',
    )

    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(CustomerEntity).update(customer.id, {
        name: dto.name ?? customer.name,
        phone: dto.phone ?? customer.phone,
        email: dto.email !== undefined ? dto.email : customer.email,
        status: dto.status ?? customer.status,
      })

      if (dto.tagIds || dto.segmentIds || dto.companyIds) {
        await this.syncRelations(manager, id, dto)
      }

      return this.detail(id, manager)
    })
  }

  async remove(id: number) {
    const customer = await this.findOneForTenantOrFail(
      this.customerRepository,
      { id },
      'Customer not found',
    )

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(CustomerTagMapEntity).delete({ customerId: id })
      await manager.getRepository(CustomerSegmentEntity).delete({ customerId: id })
      await manager.getRepository(CustomerCompanyEntity).delete({ customerId: id })
      await manager.getRepository(CustomerEntity).remove(customer)
    })
  }

  async findOrCreateByContact(
    input: FindOrCreateCustomerInput,
  ): Promise<CustomerEntity> {
    const tenantId = this.requireTenantId()

    if (input.phone) {
      const byPhone = await this.customerRepository.findOne({
        where: { tenantId, phone: input.phone },
      })
      if (byPhone) {
        return byPhone
      }
    }

    if (input.email) {
      const byEmail = await this.customerRepository.findOne({
        where: { tenantId, email: input.email },
      })
      if (byEmail) {
        return byEmail
      }
    }

    return this.customerRepository.save({
      tenantId,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      status: CustomerStatus.ACTIVE,
    })
  }

  private async getCustomerTags(customerId: number, manager?: EntityManager) {
    const tagMapRepository = manager
      ? manager.getRepository(CustomerTagMapEntity)
      : this.tagMapRepository
    const tagRepository = manager
      ? manager.getRepository(CustomerTagEntity)
      : this.tagRepository

    const maps = await tagMapRepository.find({ where: { customerId } })
    if (!maps.length) {
      return []
    }

    const tags = await tagRepository.find({
      where: {
        id: In(maps.map((m) => m.tagId)),
        tenantId: this.requireTenantId(),
      },
    })

    return tags.map((t) => t.name)
  }

  private async syncRelations(
    manager: EntityManager,
    customerId: number,
    dto: Pick<CreateCustomerDto, 'tagIds' | 'segmentIds' | 'companyIds'>,
  ) {
    if (dto.tagIds) {
      await manager.getRepository(CustomerTagMapEntity).delete({ customerId })
      if (dto.tagIds.length) {
        await manager.getRepository(CustomerTagMapEntity).save(
          dto.tagIds.map((tagId) => ({ customerId, tagId })),
        )
      }
    }

    if (dto.segmentIds) {
      await manager.getRepository(CustomerSegmentEntity).delete({ customerId })
      if (dto.segmentIds.length) {
        await manager.getRepository(CustomerSegmentEntity).save(
          dto.segmentIds.map((segmentId) => ({ customerId, segmentId })),
        )
      }
    }

    if (dto.companyIds) {
      await manager.getRepository(CustomerCompanyEntity).delete({ customerId })
      if (dto.companyIds.length) {
        await manager.getRepository(CustomerCompanyEntity).save(
          dto.companyIds.map((companyId) => ({ customerId, companyId })),
        )
      }
    }
  }
}