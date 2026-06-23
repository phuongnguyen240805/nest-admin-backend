import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import {
  CategoryQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../dto/category.dto'
import { ProductCategoryEntity, ProductEntity } from '../entities'

@Injectable()
export class CategoryService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(ProductCategoryEntity)
    private readonly categoryRepository: Repository<ProductCategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: CategoryQueryDto) {
    const tenantId = this.requireTenantId()
    const qb = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.tenantId = :tenantId', { tenantId })

    if (dto.search) {
      qb.andWhere('category.name ILIKE :search', { search: `%${dto.search}%` })
    }

    qb.orderBy('category.createdAt', 'DESC')
    const result = await paginate(qb, { page: dto.page, pageSize: dto.pageSize })

    const items = await Promise.all(
      result.items.map(async (category) => ({
        ...category,
        productCount: await this.productRepository.count({
          where: { categoryId: category.id, tenantId },
        }),
      })),
    )

    return new Pagination(items, result.meta)
  }

  async detail(id: number) {
    return this.findOneForTenantOrFail(
      this.categoryRepository,
      { id },
      'Category not found',
    )
  }

  async create(dto: CreateCategoryDto) {
    const category = await this.categoryRepository.save({
      tenantId: this.requireTenantId(),
      name: dto.name,
      parentId: dto.parentId ?? null,
      imageUrl: dto.imageUrl ?? null,
      visible: dto.visible ?? true,
    })
    return { ...category, productCount: 0 }
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const category = await this.detail(id)
    Object.assign(category, dto)
    return this.categoryRepository.save(category)
  }

  async remove(id: number) {
    const category = await this.detail(id)
    await this.categoryRepository.remove(category)
  }
}