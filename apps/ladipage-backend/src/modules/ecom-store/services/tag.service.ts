import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '~/helper/paginate'
import { Pagination } from '~/helper/paginate/pagination'
import { TenantContextService } from '~/modules/tenant/tenant-context.service'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { EcomEntityType } from '../common/enums'
import { CreateTagDto, TagQueryDto, UpdateTagDto } from '../dto/tag.dto'
import {
  OrderTagEntity,
  OrderTagMapEntity,
  ProductTagEntity,
  ProductTagMapEntity,
} from '../entities'

@Injectable()
export class EcomTagService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(ProductTagEntity)
    private readonly productTagRepository: Repository<ProductTagEntity>,
    @InjectRepository(OrderTagEntity)
    private readonly orderTagRepository: Repository<OrderTagEntity>,
    @InjectRepository(ProductTagMapEntity)
    private readonly productTagMapRepository: Repository<ProductTagMapEntity>,
    @InjectRepository(OrderTagMapEntity)
    private readonly orderTagMapRepository: Repository<OrderTagMapEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: TagQueryDto) {
    const tenantId = this.requireTenantId()
    const repo = this.getTagRepository(dto.entity)
    const mapRepo = this.getTagMapRepository(dto.entity)

    const qb = repo
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
        count: await mapRepo.count({ where: { tagId: tag.id } }),
      })),
    )

    return new Pagination(items, result.meta)
  }

  async detail(entity: EcomEntityType, id: number) {
    const repo = this.getTagRepository(entity)
    const mapRepo = this.getTagMapRepository(entity)
    const tag = await this.findOneForTenantOrFail(repo, { id }, 'Tag not found')
    const count = await mapRepo.count({ where: { tagId: id } })
    return { ...tag, count }
  }

  async create(dto: CreateTagDto) {
    const repo = this.getTagRepository(dto.entity)
    return repo.save({
      tenantId: this.requireTenantId(),
      name: dto.name,
    })
  }

  async update(entity: EcomEntityType, id: number, dto: UpdateTagDto) {
    const repo = this.getTagRepository(entity)
    const tag = await this.findOneForTenantOrFail(repo, { id }, 'Tag not found')
    if (dto.name) {
      tag.name = dto.name
    }
    return repo.save(tag)
  }

  async remove(entity: EcomEntityType, id: number) {
    const repo = this.getTagRepository(entity)
    const mapRepo = this.getTagMapRepository(entity)
    const tag = await this.findOneForTenantOrFail(repo, { id }, 'Tag not found')
    await mapRepo.delete({ tagId: id })
    await repo.remove(tag)
  }

  private getTagRepository(entity: EcomEntityType) {
    if (entity === EcomEntityType.PRODUCT) {
      return this.productTagRepository
    }
    if (entity === EcomEntityType.ORDER) {
      return this.orderTagRepository
    }
    throw new BadRequestException('entity must be order or product')
  }

  private getTagMapRepository(entity: EcomEntityType) {
    if (entity === EcomEntityType.PRODUCT) {
      return this.productTagMapRepository
    }
    if (entity === EcomEntityType.ORDER) {
      return this.orderTagMapRepository
    }
    throw new BadRequestException('entity must be order or product')
  }
}