import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { CreateTagDto, TagQueryDto, UpdateTagDto } from '../dto/tag.dto'
import {
  CrmPersonTagMapEntity,
  CustomerTagEntity,
  CustomerTagMapEntity,
} from '../entities'

@Injectable()
export class CrmTagService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CustomerTagEntity)
    private readonly tagRepository: Repository<CustomerTagEntity>,
    @InjectRepository(CustomerTagMapEntity)
    private readonly tagMapRepository: Repository<CustomerTagMapEntity>,
    @InjectRepository(CrmPersonTagMapEntity)
    private readonly personTagMapRepository: Repository<CrmPersonTagMapEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: TagQueryDto) {
    const tenantId = this.requireTenantId()
    const qb = this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.tenantId = :tenantId', { tenantId })

    if (dto.search) {
      qb.andWhere('tag.name ILIKE :search', { search: `%${dto.search}%` })
    }

    qb.orderBy('tag.createdAt', 'DESC')
    const result = await paginate(qb, { page: dto.page, pageSize: dto.pageSize })

    const items = await Promise.all(
      result.items.map(async (tag) => ({
        ...tag,
        count: await this.countCustomersForTag(tag.id),
      })),
    )

    return new Pagination(items, result.meta)
  }

  async detail(id: number) {
    const tag = await this.findOneForTenantOrFail(
      this.tagRepository,
      { id },
      'Tag not found',
    )
    const count = await this.countCustomersForTag(id)
    return { ...tag, count }
  }

  async create(dto: CreateTagDto) {
    return this.tagRepository.save({
      tenantId: this.requireTenantId(),
      name: dto.name,
    })
  }

  async update(id: number, dto: UpdateTagDto) {
    const tag = await this.findOneForTenantOrFail(
      this.tagRepository,
      { id },
      'Tag not found',
    )
    if (dto.name) {
      tag.name = dto.name
    }
    return this.tagRepository.save(tag)
  }

  async remove(id: number) {
    const tag = await this.findOneForTenantOrFail(
      this.tagRepository,
      { id },
      'Tag not found',
    )
    await this.tagMapRepository.delete({ tagId: id })
    await this.personTagMapRepository.delete({ tagId: id })
    await this.tagRepository.remove(tag)
  }

  private async countCustomersForTag(tagId: number): Promise<number> {
    const [legacy, persons] = await Promise.all([
      this.tagMapRepository.count({ where: { tagId } }),
      this.personTagMapRepository.count({ where: { tagId } }),
    ])
    return legacy + persons
  }
}