import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
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
    const tenantId = this.requireTenantId()
    if (dto.entity === EcomEntityType.ORDER) {
      return this.orderTagRepository.save({
        tenantId,
        name: dto.name,
        color: dto.color ?? '#e5e7eb',
      })
    }
    return this.productTagRepository.save({
      tenantId,
      name: dto.name,
    })
  }

  async update(entity: EcomEntityType, id: number, dto: UpdateTagDto) {
    if (entity === EcomEntityType.ORDER) {
      const tag = await this.findOneForTenantOrFail(
        this.orderTagRepository,
        { id },
        'Tag not found',
      )
      if (dto.name) tag.name = dto.name
      if (dto.color) tag.color = dto.color
      return this.orderTagRepository.save(tag)
    }

    const tag = await this.findOneForTenantOrFail(
      this.productTagRepository,
      { id },
      'Tag not found',
    )
    if (dto.name) tag.name = dto.name
    return this.productTagRepository.save(tag)
  }

  async remove(entity: EcomEntityType, id: number) {
    const mapRepo = this.getTagMapRepository(entity)
    await mapRepo.delete({ tagId: id })

    if (entity === EcomEntityType.ORDER) {
      const tag = await this.findOneForTenantOrFail(
        this.orderTagRepository,
        { id },
        'Tag not found',
      )
      await this.orderTagRepository.remove(tag)
      return
    }

    const tag = await this.findOneForTenantOrFail(
      this.productTagRepository,
      { id },
      'Tag not found',
    )
    await this.productTagRepository.remove(tag)
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