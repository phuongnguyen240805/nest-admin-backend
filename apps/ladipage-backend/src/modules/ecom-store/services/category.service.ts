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
import { ProductCategoryEntity } from '../entities'

@Injectable()
export class CategoryService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(ProductCategoryEntity)
    private readonly categoryRepository: Repository<ProductCategoryEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: CategoryQueryDto): Promise<Pagination<ProductCategoryEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.tenantId = :tenantId', { tenantId })

    if (dto.search) {
      qb.andWhere('category.name ILIKE :search', { search: `%${dto.search}%` })
    }

    qb.orderBy('category.createdAt', 'DESC')
    return paginate(qb, { page: dto.page, pageSize: dto.pageSize })
  }

  async detail(id: number) {
    return this.findOneForTenantOrFail(
      this.categoryRepository,
      { id },
      'Category not found',
    )
  }

  async create(dto: CreateCategoryDto) {
    return this.categoryRepository.save({
      tenantId: this.requireTenantId(),
      name: dto.name,
      parentId: dto.parentId ?? null,
    })
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