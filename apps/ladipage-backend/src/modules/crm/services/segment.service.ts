import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { DEFAULT_SEGMENT_DEFINITIONS } from '../constants/default-segments'
import {
  CreateSegmentDto,
  SegmentQueryDto,
  UpdateSegmentDto,
} from '../dto/segment.dto'
import {
  CrmPersonSegmentMapEntity,
  CustomerSegmentEntity,
  SegmentEntity,
} from '../entities'

@Injectable()
export class SegmentService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SegmentEntity)
    private readonly segmentRepository: Repository<SegmentEntity>,
    @InjectRepository(CustomerSegmentEntity)
    private readonly customerSegmentRepository: Repository<CustomerSegmentEntity>,
    @InjectRepository(CrmPersonSegmentMapEntity)
    private readonly personSegmentMapRepository: Repository<CrmPersonSegmentMapEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: SegmentQueryDto) {
    const tenantId = this.requireTenantId()
    await this.ensureDefaultSegments(tenantId)

    const qb = this.segmentRepository
      .createQueryBuilder('segment')
      .where('segment.tenantId = :tenantId', { tenantId })

    if (dto.search) {
      qb.andWhere('segment.name ILIKE :search', { search: `%${dto.search}%` })
    }

    qb.orderBy('segment.isDefault', 'DESC').addOrderBy('segment.createdAt', 'DESC')
    const result = await paginate(qb, { page: dto.page, pageSize: dto.pageSize })

    const items = await Promise.all(
      result.items.map(async (segment) => ({
        ...segment,
        customerCount: await this.countCustomersForSegment(segment.id),
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
    const customerCount = await this.countCustomersForSegment(id)
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
    if (segment.isDefault) {
      throw new BadRequestException('Cannot delete default segment')
    }
    await this.customerSegmentRepository.delete({ segmentId: id })
    await this.personSegmentMapRepository.delete({ segmentId: id })
    await this.segmentRepository.remove(segment)
  }

  private async ensureDefaultSegments(tenantId: number): Promise<void> {
    const existing = await this.segmentRepository.find({
      where: { tenantId, isDefault: true },
      select: ['name'],
    })
    const existingNames = new Set(existing.map((segment) => segment.name))
    const missing = DEFAULT_SEGMENT_DEFINITIONS.filter(
      (definition) => !existingNames.has(definition.name),
    )
    if (missing.length === 0) {
      return
    }

    await this.segmentRepository.save(
      missing.map((definition) => ({
        tenantId,
        name: definition.name,
        isDefault: true,
        rules: { alias: definition.alias },
      })),
    )
  }

  private async countCustomersForSegment(segmentId: number): Promise<number> {
    const [legacy, persons] = await Promise.all([
      this.customerSegmentRepository.count({ where: { segmentId } }),
      this.personSegmentMapRepository.count({ where: { segmentId } }),
    ])
    return legacy + persons
  }
}