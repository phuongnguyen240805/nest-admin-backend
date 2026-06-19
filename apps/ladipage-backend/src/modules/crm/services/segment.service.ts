import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import {
  CreateSegmentDto,
  SegmentQueryDto,
  UpdateSegmentDto,
} from '../dto/segment.dto'
import { CustomerSegmentEntity, SegmentEntity } from '../entities'

@Injectable()
export class SegmentService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SegmentEntity)
    private readonly segmentRepository: Repository<SegmentEntity>,
    @InjectRepository(CustomerSegmentEntity)
    private readonly customerSegmentRepository: Repository<CustomerSegmentEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: SegmentQueryDto) {
    const tenantId = this.requireTenantId()
    const qb = this.segmentRepository
      .createQueryBuilder('segment')
      .where('segment.tenantId = :tenantId', { tenantId })

    if (dto.search) {
      qb.andWhere('segment.name ILIKE :search', { search: `%${dto.search}%` })
    }

    qb.orderBy('segment.createdAt', 'DESC')
    const result = await paginate(qb, { page: dto.page, pageSize: dto.pageSize })

    const items = await Promise.all(
      result.items.map(async (segment) => ({
        ...segment,
        customerCount: await this.customerSegmentRepository.count({
          where: { segmentId: segment.id },
        }),
      })),
    )

    return new Pagination(items, result.meta)
  }

  async detail(id: number) {
    const segment = await this.findOneForTenantOrFail(
      this.segmentRepository,
      { id },
      'Segment not found',
    )
    const customerCount = await this.customerSegmentRepository.count({
      where: { segmentId: id },
    })
    return { ...segment, customerCount }
  }

  async create(dto: CreateSegmentDto) {
    return this.segmentRepository.save({
      tenantId: this.requireTenantId(),
      name: dto.name,
      isDefault: dto.isDefault ?? false,
      rules: dto.rules ?? null,
    })
  }

  async update(id: number, dto: UpdateSegmentDto) {
    const segment = await this.findOneForTenantOrFail(
      this.segmentRepository,
      { id },
      'Segment not found',
    )
    Object.assign(segment, dto)
    return this.segmentRepository.save(segment)
  }

  async remove(id: number) {
    const segment = await this.findOneForTenantOrFail(
      this.segmentRepository,
      { id },
      'Segment not found',
    )
    await this.customerSegmentRepository.delete({ segmentId: id })
    await this.segmentRepository.remove(segment)
  }
}